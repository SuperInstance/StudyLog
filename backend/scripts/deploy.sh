#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# deploy.sh - Deploy all StudyLoG.AI backend workers to Cloudflare
# ═══════════════════════════════════════════════════════════════════════════════
#
# This script deploys all Cloudflare Workers in the correct dependency order:
#
# 1. first-mile-router      (no dependencies - DEPLOY FIRST)
# 2. multi-model-router     (no dependencies, but references first-mile-router)
# 3. g-assist-api           (depends on first-mile-router and multi-model-router)
#
# DEPLOYMENT ORDER MATTERS:
#
# - first-mile-router goes first because it's the "decision layer" that other
#   workers query for intent classification. If we deployed multi-model-router
#   first, it would fail when trying to reach first-mile-router for cascade.
#
# - multi-model-router goes second because g-assist-api calls it for LLM
#   completions. It can function without first-mile-router (falls back to
#   direct routing), but works best with cascade enabled.
#
# - g-assist-api goes last because it depends on both. It will use Workers AI
#   fallback if either router is unavailable, but full functionality requires
#   both to be deployed.
#
# ═══════════════════════════════════════════════════════════════════════════════
# Usage
# ═══════════════════════════════════════════════════════════════════════════════
#
#   # From backend directory:
#   ./scripts/deploy.sh
#
#   # Deploy specific worker only:
#   ./scripts/deploy.sh first-mile-router
#
#   # Skip secrets prompt (for CI/CD):
#   CI=true ./scripts/deploy.sh
#
# ═══════════════════════════════════════════════════════════════════════════════
# Prerequisites
# ═══════════════════════════════════════════════════════════════════════════════
#
# 1. Install Wrangler CLI:
#    npm install -g wrangler
#
# 2. Authenticate with Cloudflare:
#    wrangler login
#
# 3. Set up resources (first time only):
#    ./scripts/setup-d1.sh    # Create D1 databases
#    ./scripts/setup-kv.sh    # Create KV namespaces
#    # Then update wrangler.toml files with the IDs from those scripts
#
# 4. Set secrets (first time only):
#    cd workers/multi-model-router
#    wrangler secret put OPENAI_API_KEY
#    wrangler secret put ANTHROPIC_API_KEY
#    # etc. for each provider you have access to
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# Worker directories in deployment order
# Order matters! Dependencies must be deployed before dependents.
declare -A WORKERS
WORKERS[first-mile-router]="workers/first-mile-router"
WORKERS[multi-model-router]="workers/multi-model-router"
WORKERS[g-assist-api]="workers/g-assist-api"

# ═══════════════════════════════════════════════════════════════════════════════
# Utility Functions
# ═══════════════════════════════════════════════════════════════════════════════

print_header() {
    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}➜${NC} $1"
}

print_info() {
    echo -e "${GRAY}  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

check_wrangler() {
    if ! command -v wrangler &> /dev/null; then
        print_error "Wrangler CLI not found. Install with: npm install -g wrangler"
        exit 1
    fi
    print_success "Wrangler CLI found"
}

check_auth() {
    if ! wrangler whoami &> /dev/null; then
        print_error "Not authenticated with Cloudflare. Run: wrangler login"
        exit 1
    fi
    print_success "Authenticated with Cloudflare"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Deployment Functions
# ═══════════════════════════════════════════════════════════════════════════════

deploy_worker() {
    local worker_name="$1"
    local worker_dir="${WORKERS[$worker_name]}"

    print_header "Deploying: $worker_name"

    # Check if worker directory exists
    if [ ! -d "$BACKEND_DIR/$worker_dir" ]; then
        print_error "Worker directory not found: $worker_dir"
        return 1
    fi

    # Check if wrangler.toml exists
    if [ ! -f "$BACKEND_DIR/$worker_dir/wrangler.toml" ]; then
        print_error "wrangler.toml not found for $worker_name"
        return 1
    fi

    # Check for placeholder IDs
    if grep -q "your_.*_id" "$BACKEND_DIR/$worker_dir/wrangler.toml"; then
        print_warning "This worker has placeholder IDs in wrangler.toml"
        print_info "Run ./scripts/setup-d1.sh and ./scripts/setup-kv.sh first"
        print_info "Then update wrangler.toml with the actual IDs"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Skipping $worker_name"
            return 0
        fi
    fi

    print_step "Changing to worker directory: $worker_dir"
    cd "$BACKEND_DIR/$worker_dir"

    # Check if secrets are needed
    print_info "Checking secrets configuration..."
    if [ "$worker_name" = "multi-model-router" ]; then
        print_info "Required secrets for multi-model-router:"
        print_info "  - OPENAI_API_KEY (optional, for OpenAI provider)"
        print_info "  - ANTHROPIC_API_KEY (optional, for Anthropic provider)"
        print_info "  - GOOGLE_API_KEY (optional, for Google provider)"
        print_info "  - NVIDIA_API_KEY (optional, for NVIDIA provider)"
        print_info ""
        print_info "Set secrets with: wrangler secret put <KEY>"
    fi

    # Deploy the worker
    print_step "Running: wrangler publish"
    if wrangler publish; then
        print_success "$worker_name deployed successfully"

        # Get and display the worker URL
        local worker_url=$(wrangler deployments list 2>/dev/null | grep -m 1 "$worker_name" | awk '{print $3}' || echo "")
        if [ -n "$worker_url" ]; then
            print_info "Worker URL: $worker_url"
        fi

        return 0
    else
        print_error "$worker_name deployment failed"
        return 1
    fi
}

deploy_all() {
    local failures=()

    print_header "StudyLoG.AI Backend Deployment"

    print_step "Checking prerequisites..."
    check_wrangler
    check_auth

    print_step "Changing to backend directory: $BACKEND_DIR"
    cd "$BACKEND_DIR"

    # Prompt about secrets on first deployment
    if [ -z "$CI" ]; then
        print_warning "Secret Management Reminder"
        print_info "API keys should be set as secrets, not in wrangler.toml"
        print_info ""
        print_info "For each worker, set secrets with:"
        print_info "  cd workers/<worker-name>"
        print_info "  wrangler secret put OPENAI_API_KEY"
        print_info ""
        read -p "Press Enter to continue, or Ctrl+C to cancel..."
        echo ""
    fi

    # Deploy workers in dependency order
    for worker_name in "first-mile-router" "multi-model-router" "g-assist-api"; do
        if ! deploy_worker "$worker_name"; then
            failures+=("$worker_name")
            print_warning "Continuing with remaining workers..."
        fi
    done

    # Summary
    print_header "Deployment Summary"

    if [ ${#failures[@]} -eq 0 ]; then
        print_success "All workers deployed successfully!"
        echo ""
        print_info "Next steps:"
        print_info "1. Test your workers:"
        print_info "   curl https://first-mile-router.studylog.workers.dev/"
        print_info "   curl https://multi-model-router.studylog.workers.dev/"
        print_info "   curl https://g-assist-api.studylog.workers.dev/"
        print_info ""
        print_info "2. Update environment variables in dependent workers with"
        print_info "   the actual worker URLs from deployment output"
        print_info ""
        print_info "3. Set any missing secrets:"
        print_info "   cd workers/multi-model-router"
        print_info "   wrangler secret put OPENAI_API_KEY"
    else
        print_error "Some workers failed to deploy:"
        for failed in "${failures[@]}"; do
            print_error "  - $failed"
        done
        print_info "Fix the issues above and run this script again"
        exit 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main Entry Point
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    if [ $# -eq 0 ]; then
        # No arguments - deploy all workers
        deploy_all
    elif [ $# -eq 1 ]; then
        # Single worker specified
        local worker_arg="$1"

        # Validate worker name
        if [[ ! -v "WORKERS[$worker_arg]" ]]; then
            print_error "Unknown worker: $worker_arg"
            print_info "Available workers: ${!WORKERS[@]}"
            exit 1
        fi

        check_wrangler
        check_auth
        cd "$BACKEND_DIR"

        if ! deploy_worker "$worker_arg"; then
            exit 1
        fi
    else
        echo "Usage: $0 [worker-name]"
        echo ""
        echo "Workers:"
        for worker in "${!WORKERS[@]}"; do
            echo "  - $worker"
        done
        exit 1
    fi
}

# Run main function
main "$@"

#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# setup-kv.sh - Create and configure KV namespaces for StudyLoG.AI
# ═══════════════════════════════════════════════════════════════════════════════
#
# This script creates all KV namespaces needed for StudyLoG.AI workers.
# It outputs the namespace IDs that need to be added to wrangler.toml files.
#
# ═══════════════════════════════════════════════════════════════════════════════
# KV Namespaces Created
# ═══════════════════════════════════════════════════════════════════════════════
#
# 1. classification-cache    - Intent classification cache (first-mile-router)
# 2. router-cache           - LLM response cache (multi-model-router)
# 3. assistant-cache        - Chat response cache (g-assist-api)
# 4. rate-limits            - Rate limiting counters (g-assist-api)
#
# ═══════════════════════════════════════════════════════════════════════════════
# Usage
# ═══════════════════════════════════════════════════════════════════════════════
#
#   # From backend directory:
#   ./scripts/setup-kv.sh
#
#   # Create specific namespace only:
#   ./scripts/setup-kv.sh classification-cache
#
#   # Skip confirmation prompts:
#   YES=true ./scripts/setup-kv.sh
#
#   # List existing namespaces:
#   ./scripts/setup-kv.sh list
#
# ═══════════════════════════════════════════════════════════════════════════════
# After Running This Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# 1. Copy the namespace IDs from the output
# 2. Update wrangler.toml files:
#    - workers/first-mile-router/wrangler.toml
#    - workers/multi-model-router/wrangler.toml
#    - workers/g-assist-api/wrangler.toml
#
# 3. Replace the placeholder IDs with the actual IDs from this script
#
# ═══════════════════════════════════════════════════════════════════════════════
# KV Namespace Best Practices
# ═══════════════════════════════════════════════════════════════════════════════
#
# - Cache TTL: Use appropriate expiration times (1-24 hours typically)
# - Keys: Prefix keys with service name for easy identification
# - Values: Keep values under 1MB (Cloudflare KV limit)
# - Reads: KV is eventually consistent - reads may be stale for up to 60s
# - Preview: Separate preview namespaces for dev/testing
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
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# KV namespace definitions with descriptions
declare -A NAMESPACES
NAMESPACES[classification-cache]="Intent classification cache for first-mile-router"
NAMESPACES[router-cache]="LLM response cache for multi-model-router"
NAMESPACES[assistant-cache]="Chat response cache for g-assist-api"
NAMESPACES[rate-limits]="Rate limiting counters for g-assist-api"

# Store created namespace IDs
declare -A CREATED_IDS

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

print_id() {
    echo -e "${CYAN}  →${NC} ID: ${CYAN}$1${NC}"
}

print_preview_id() {
    echo -e "${CYAN}  →${NC} Preview ID: ${CYAN}$1${NC}"
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
# KV Namespace Functions
# ═══════════════════════════════════════════════════════════════════════════════

create_namespace() {
    local ns_name="$1"
    local description="${NAMESPACES[$ns_name]}"

    print_header "Creating KV Namespace: $ns_name"
    print_info "$description"
    echo ""

    # Check if namespace already exists
    print_step "Checking if namespace exists..."
    local existing_output=$(wrangler kv:namespace list 2>/dev/null || echo "")
    local existing_id=$(echo "$existing_output" | grep "\"id\":" | grep -o '"title":"[^"]*"' | xargs -I {} grep {} <<< "$existing_output" | grep "\"id\":" | head -1 | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || true)

    # More thorough check
    local ns_list=$(wrangler kv:namespace list 2>/dev/null || echo "[]")
    if echo "$ns_list" | grep -q "\"title\":\"$ns_name\""; then
        existing_id=$(echo "$ns_list" | grep -o "\"title\":\"$ns_name\"" -A 2 | grep "\"id\"" | head -1 | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    fi

    if [ -n "$existing_id" ]; then
        print_warning "Namespace '$ns_name' already exists"
        print_id "$existing_id"
        CREATED_IDS[$ns_name]="$existing_id"

        if [ "$YES" != "true" ]; then
            read -p "Recreate namespace? This will DELETE all cached data. (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_info "Keeping existing namespace"
                # Also create preview namespace
                create_preview_namespace "$ns_name"
                return 0
            fi

            print_warning "Note: KV namespaces cannot be deleted via wrangler"
            print_info "You'll need to delete it from the Cloudflare Dashboard manually"
            print_info "Creating a new namespace instead..."
            ns_name="${ns_name}-new-$(date +%s)"
        fi
    fi

    # Create the production namespace
    print_step "Creating namespace: $ns_name"
    local output=$(wrangler kv:namespace create "$ns_name" 2>&1)
    local ns_id=$(echo "$output" | grep "id =" | awk '{print $3}' || echo "")

    if [ -z "$ns_id" ]; then
        # Try parsing JSON format
        ns_id=$(echo "$output" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1 || echo "")
    fi

    if [ -z "$ns_id" ]; then
        print_error "Failed to create namespace or parse ID"
        print_info "Output: $output"
        return 1
    fi

    print_success "Namespace created: $ns_name"
    print_id "$ns_id"
    CREATED_IDS[${ns_name}]="${ns_id}"

    # Create preview namespace
    create_preview_namespace "$ns_name"

    return 0
}

create_preview_namespace() {
    local ns_name="$1"
    local preview_name="${ns_name}_preview"

    print_step "Creating preview namespace: $preview_name"
    local output=$(wrangler kv:namespace create "$preview_name" --preview 2>&1)
    local preview_id=$(echo "$output" | grep "id =" | awk '{print $3}' || echo "")

    if [ -z "$preview_id" ]; then
        # Try parsing JSON format
        preview_id=$(echo "$output" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1 || echo "")
    fi

    if [ -z "$preview_id" ]; then
        print_warning "Failed to create preview namespace (non-fatal)"
    else
        print_success "Preview namespace created"
        print_preview_id "$preview_id"
        CREATED_IDS["${ns_name}_preview"]="${preview_id}"
    fi
}

create_all_namespaces() {
    local failures=()

    print_header "StudyLoG.AI KV Namespace Setup"

    print_step "Checking prerequisites..."
    check_wrangler
    check_auth

    print_step "Changing to backend directory: $BACKEND_DIR"
    cd "$BACKEND_DIR"

    if [ "$YES" != "true" ]; then
        print_warning "This will create Cloudflare KV namespaces"
        print_info "Namespaces to be created:"
        for ns_name in "${!NAMESPACES[@]}"; do
            print_info "  - $ns_name: ${NAMESPACES[$ns_name]}"
        done
        echo ""
        read -p "Continue? (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            print_info "Cancelled"
            exit 0
        fi
    fi

    # Create each namespace
    for ns_name in "classification-cache" "router-cache" "assistant-cache" "rate-limits"; do
        if ! create_namespace "$ns_name"; then
            failures+=("$ns_name")
            print_warning "Continuing with remaining namespaces..."
        fi
    done

    # Summary
    print_header "Setup Summary"

    if [ ${#failures[@]} -eq 0 ]; then
        print_success "All namespaces created successfully!"
        echo ""
        print_info "Namespace IDs (add these to wrangler.toml files):"
        echo ""
        for ns_name in "${!CREATED_IDS[@]}"; do
            if [[ ! "$ns_name" =~ _preview$ ]]; then
                local preview_key="${ns_name}_preview"
                local preview_id="${CREATED_IDS[$preview_key]:-your_preview_id}"
                echo -e "${CYAN}$ns_name:${NC}"
                echo -e "  id: ${CREATED_IDS[$ns_name]}"
                echo -e "  preview_id: $preview_id"
                echo ""
            fi
        done
        print_info "Update wrangler.toml files:"
        echo ""
        echo "  # workers/first-mile-router/wrangler.toml"
        echo "  [[kv_namespaces]]"
        echo "  binding = \"CLASSIFICATION_CACHE\""
        echo "  id = \"${CREATED_IDS[classification-cache]:-your_id}\""
        echo "  preview_id = \"${CREATED_IDS[classification-cache_preview]:-your_preview_id}\""
        echo ""
        echo "  # workers/multi-model-router/wrangler.toml"
        echo "  [[kv_namespaces]]"
        echo "  binding = \"CACHE\""
        echo "  id = \"${CREATED_IDS[router-cache]:-your_id}\""
        echo "  preview_id = \"${CREATED_IDS[router-cache_preview]:-your_preview_id}\""
        echo ""
        echo "  # workers/g-assist-api/wrangler.toml"
        echo "  [[kv_namespaces]]"
        echo "  binding = \"ASSISTANT_CACHE\""
        echo "  id = \"${CREATED_IDS[assistant-cache]:-your_id}\""
        echo "  preview_id = \"${CREATED_IDS[assistant-cache_preview]:-your_preview_id}\""
        echo ""
        echo "  [[kv_namespaces]]"
        echo "  binding = \"RATE_LIMITS\""
        echo "  id = \"${CREATED_IDS[rate-limits]:-your_id}\""
        echo "  preview_id = \"${CREATED_IDS[rate-limits_preview]:-your_preview_id}\""
        echo ""
        print_info "Then deploy workers with: ./scripts/deploy.sh"
    else
        print_error "Some namespaces failed to create:"
        for failed in "${failures[@]}"; do
            print_error "  - $failed"
        done
        exit 1
    fi
}

list_namespaces() {
    print_header "Existing KV Namespaces"

    check_wrangler
    check_auth

    print_step "Fetching namespace list..."
    wrangler kv:namespace list
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main Entry Point
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    case "${1:-}" in
        list)
            list_namespaces
            ;;
        ""|all)
            create_all_namespaces
            ;;
        *)
            # Single namespace specified
            local ns_arg="$1"

            # Validate namespace name
            if [[ ! -v "NAMESPACES[$ns_arg]" ]]; then
                print_error "Unknown namespace: $ns_arg"
                print_info "Available namespaces: ${!NAMESPACES[@]}"
                print_info ""
                print_info "Use 'list' to see existing namespaces"
                exit 1
            fi

            check_wrangler
            check_auth
            cd "$BACKEND_DIR"

            if create_namespace "$ns_arg"; then
                print_success "Namespace setup complete"
            else
                exit 1
            fi
            ;;
    esac
}

# Run main function
main "$@"

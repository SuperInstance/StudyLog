#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# setup-d1.sh - Create and configure D1 databases for StudyLoG.AI
# ═══════════════════════════════════════════════════════════════════════════════
#
# This script creates all D1 databases needed for StudyLoG.AI workers and
# runs their schema migrations. It outputs the database IDs that need to be
# added to wrangler.toml files.
#
# ═══════════════════════════════════════════════════════════════════════════════
# D1 Databases Created
# ═══════════════════════════════════════════════════════════════════════════════
#
# 1. studylog-main       - Main application database (students, progress, etc.)
# 2. multi-model-costs   - Cost tracking for multi-model-router
# 3. g-assist-conversations - Conversation history for G-Assist
# 4. student-state-db    - Student context for first-mile-router
# 5. sleep-trainer       - Agent memory and LoRA tracking
#
# ═══════════════════════════════════════════════════════════════════════════════
# Usage
# ═══════════════════════════════════════════════════════════════════════════════
#
#   # From backend directory:
#   ./scripts/setup-d1.sh
#
#   # Create specific database only:
#   ./scripts/setup-d1.sh multi-model-costs
#
#   # Skip confirmation prompts:
#   YES=true ./scripts/setup-d1.sh
#
# ═══════════════════════════════════════════════════════════════════════════════
# After Running This Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# 1. Copy the database IDs from the output
# 2. Update wrangler.toml files:
#    - workers/multi-model-router/wrangler.toml
#    - workers/g-assist-api/wrangler.toml
#    - workers/first-mile-router/wrangler.toml
#    - workers/sleep-trainer/wrangler.toml
#    - backend/wrangler.toml (for main DB)
#
# 3. Replace the placeholder IDs with the actual IDs from this script
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

# Database definitions: name -> schema file location
declare -A DATABASES
DATABASES[studylog-main]="d1/schema.sql"
DATABASES[multi-model-costs]="workers/multi-model-router/schema.sql"
DATABASES[g-assist-conversations]="workers/g-assist-api/schema.sql"
DATABASES[student-state-db]=""  # No schema, uses main DB tables
DATABASES[sleep-trainer]="workers/sleep-trainer/schema.sql"

# Store created database IDs
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
# D1 Database Functions
# ═══════════════════════════════════════════════════════════════════════════════

create_database() {
    local db_name="$1"
    local schema_file="${DATABASES[$db_name]}"

    print_header "Creating D1 Database: $db_name"

    # Check if database already exists
    print_step "Checking if database exists..."
    local existing_id=$(wrangler d1 list 2>/dev/null | grep "$db_name" | awk '{print $1}' || true)

    if [ -n "$existing_id" ]; then
        print_warning "Database '$db_name' already exists"
        print_id "$existing_id"
        CREATED_IDS[$db_name]="$existing_id"

        if [ "$YES" != "true" ]; then
            read -p "Recreate database? This will DELETE all data. (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_info "Keeping existing database"
                return 0
            fi

            print_warning "Deleting existing database..."
            wrangler d1 delete "$db_name" --yes || true
        fi
    fi

    # Create the database
    print_step "Creating database: $db_name"
    local output=$(wrangler d1 create "$db_name" 2>&1)
    local db_id=$(echo "$output" | grep "database_id" | head -1 | awk '{print $2}' || echo "")

    if [ -z "$db_id" ]; then
        print_error "Failed to create database or parse ID"
        print_info "Output: $output"
        return 1
    fi

    print_success "Database created: $db_name"
    print_id "$db_id"
    CREATED_IDS[$db_name]="$db_id"

    # Run schema if provided
    if [ -n "$schema_file" ]; then
        local schema_path="$BACKEND_DIR/$schema_file"
        if [ -f "$schema_path" ]; then
            print_step "Running schema: $schema_file"
            if wrangler d1 execute "$db_name" --file="$schema_path" --remote; then
                print_success "Schema applied successfully"
            else
                print_warning "Schema application failed (non-fatal)"
                print_info "Apply manually with: wrangler d1 execute $db_name --file=$schema_file --remote"
            fi
        else
            print_warning "Schema file not found: $schema_path"
        fi
    else
        print_info "No schema file for this database (uses shared schema)"
    fi

    return 0
}

create_all_databases() {
    local failures=()

    print_header "StudyLoG.AI D1 Database Setup"

    print_step "Checking prerequisites..."
    check_wrangler
    check_auth

    print_step "Changing to backend directory: $BACKEND_DIR"
    cd "$BACKEND_DIR"

    if [ "$YES" != "true" ]; then
        print_warning "This will create Cloudflare D1 databases"
        print_info "Databases to be created:"
        for db_name in "${!DATABASES[@]}"; do
            print_info "  - $db_name"
        done
        echo ""
        read -p "Continue? (Y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            print_info "Cancelled"
            exit 0
        fi
    fi

    # Create each database
    for db_name in "${!DATABASES[@]}"; do
        if ! create_database "$db_name"; then
            failures+=("$db_name")
            print_warning "Continuing with remaining databases..."
        fi
    done

    # Summary
    print_header "Setup Summary"

    if [ ${#failures[@]} -eq 0 ]; then
        print_success "All databases created successfully!"
        echo ""
        print_info "Database IDs (add these to wrangler.toml files):"
        echo ""
        for db_name in "${!CREATED_IDS[@]}"; do
            echo -e "${CYAN}$db_name:${NC} ${CREATED_IDS[$db_name]}"
        done
        echo ""
        print_info "Update wrangler.toml files:"
        echo ""
        echo "  # workers/multi-model-router/wrangler.toml"
        echo "  [[d1_databases]]"
        echo "  binding = \"DB\""
        echo "  database_name = \"multi-model-costs\""
        echo "  database_id = \"${CREATED_IDS[multi-model-costs]}\""
        echo ""
        echo "  # workers/g-assist-api/wrangler.toml"
        echo "  [[d1_databases]]"
        echo "  binding = \"CONVERSATIONS\""
        echo "  database_name = \"g-assist-conversations\""
        echo "  database_id = \"${CREATED_IDS[g-assist-conversations]}\""
        echo ""
        echo "  # workers/first-mile-router/wrangler.toml"
        echo "  [[d1_databases]]"
        echo "  binding = \"STUDENT_STATE\""
        echo "  database_name = \"student-state-db\""
        echo "  database_id = \"${CREATED_IDS[student-state-db]}\""
        echo ""
        print_info "Then deploy workers with: ./scripts/deploy.sh"
    else
        print_error "Some databases failed to create:"
        for failed in "${failures[@]}"; do
            print_error "  - $failed"
        done
        exit 1
    fi
}

list_databases() {
    print_header "Existing D1 Databases"

    check_wrangler
    check_auth

    print_step "Fetching database list..."
    wrangler d1 list
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main Entry Point
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    case "${1:-}" in
        list)
            list_databases
            ;;
        ""|all)
            create_all_databases
            ;;
        *)
            # Single database specified
            local db_arg="$1"

            # Validate database name
            if [[ ! -v "DATABASES[$db_arg]" ]]; then
                print_error "Unknown database: $db_arg"
                print_info "Available databases: ${!DATABASES[@]}"
                print_info ""
                print_info "Use 'list' to see existing databases"
                exit 1
            fi

            check_wrangler
            check_auth
            cd "$BACKEND_DIR"

            if create_database "$db_arg"; then
                print_success "Database setup complete"
            else
                exit 1
            fi
            ;;
    esac
}

# Run main function
main "$@"

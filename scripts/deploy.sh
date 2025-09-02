#!/bin/bash

# VAMP Deployment Script
# Handles production deployment with backup and rollback capabilities

set -e

echo "🚀 Starting VAMP deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="vamp"
APP_DIR="/opt/vamp"
BACKUP_DIR="/opt/vamp/backups"
LOG_DIR="/opt/vamp/logs"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}❌ Error: $1${NC}" >&2
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."

    # Check if running as root or with sudo
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root"
        exit 1
    fi

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
        exit 1
    fi

    # Check Node.js version
    NODE_VERSION=$(node --version | sed 's/v//')
    REQUIRED_VERSION="18.0.0"

    if ! [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
        error "Node.js version $NODE_VERSION is too old. Required: $REQUIRED_VERSION+"
        exit 1
    fi

    success "Pre-deployment checks passed"
}

# Create backup
create_backup() {
    log "Creating application backup..."

    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"

    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"

    # Backup database and uploads
    if [ -d "$APP_DIR/database" ] || [ -d "$APP_DIR/uploads" ]; then
        tar -czf "$BACKUP_FILE" -C "$APP_DIR" database uploads 2>/dev/null || true
        success "Backup created: $BACKUP_FILE"
    else
        warning "No database or uploads to backup"
    fi
}

# Stop existing application
stop_application() {
    log "Stopping existing application..."

    # Try to stop using PM2 if available
    if command -v pm2 &> /dev/null; then
        pm2 stop "$APP_NAME" 2>/dev/null || true
        pm2 delete "$APP_NAME" 2>/dev/null || true
    fi

    # Kill any remaining processes
    pkill -f "node.*server-simple.js" || true

    success "Application stopped"
}

# Deploy new version
deploy_application() {
    log "Deploying new application version..."

    # Install dependencies
    log "Installing dependencies..."
    npm ci --production

    # Create necessary directories
    mkdir -p database uploads/temp uploads/works logs

    # Set proper permissions
    chmod +x scripts/*.js
    chmod +x scripts/*.sh

    success "Application deployed"
}

# Start application
start_application() {
    log "Starting application..."

    # Start with PM2 if available
    if command -v pm2 &> /dev/null; then
        pm2 start scripts/start-production.js --name "$APP_NAME"
        pm2 save
        success "Application started with PM2"
    else
        # Start directly
        nohup node scripts/start-production.js > "$LOG_DIR/app.log" 2>&1 &
        echo $! > "$APP_DIR/app.pid"
        success "Application started directly (PID: $(cat "$APP_DIR/app.pid"))"
    fi
}

# Health check
health_check() {
    log "Performing health check..."

    MAX_ATTEMPTS=30
    ATTEMPT=1

    while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
        if curl -f -s http://localhost:3000/health > /dev/null; then
            success "Health check passed"
            return 0
        fi

        log "Health check attempt $ATTEMPT/$MAX_ATTEMPTS failed, retrying..."
        sleep 2
        ((ATTEMPT++))
    done

    error "Health check failed after $MAX_ATTEMPTS attempts"
    return 1
}

# Post-deployment tasks
post_deployment_tasks() {
    log "Running post-deployment tasks..."

    # Clean up old backups (keep last 10)
    if [ -d "$BACKUP_DIR" ]; then
        ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm
    fi

    # Run database backup
    if [ -f "scripts/backup-db.js" ]; then
        node scripts/backup-db.js
    fi

    success "Post-deployment tasks completed"
}

# Rollback function
rollback() {
    error "Deployment failed, initiating rollback..."

    # Stop failed application
    stop_application

    # Find latest backup
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -n1)

    if [ -n "$LATEST_BACKUP" ]; then
        log "Restoring from backup: $LATEST_BACKUP"
        tar -xzf "$LATEST_BACKUP" -C "$APP_DIR"
        start_application

        if health_check; then
            success "Rollback successful"
            exit 0
        fi
    fi

    error "Rollback failed"
    exit 1
}

# Main deployment function
main() {
    log "Starting VAMP deployment process..."

    # Trap errors for rollback
    trap rollback ERR

    pre_deployment_checks
    create_backup
    stop_application
    deploy_application
    start_application

    if health_check; then
        post_deployment_tasks
        success "🎉 VAMP deployment completed successfully!"
        echo ""
        echo "🌐 Application is running at: http://localhost:3000"
        echo "📊 Health check endpoint: http://localhost:3000/health"
        echo "📝 Logs available at: $LOG_DIR/"
    else
        error "Deployment failed - health check unsuccessful"
        exit 1
    fi
}

# Run main function
main "$@"

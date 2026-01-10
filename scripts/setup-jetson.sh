#!/bin/bash
# StudyLoG.AI - Jetson Setup Script
# Optimized setup for NVIDIA Jetson devices (Nano, Xavier, Orin)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   StudyLoG.AI - Jetson Setup           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if running on Jetson
if [[ ! -f /etc/nv_tegra_release ]] && ! grep -q "Jetson\|Tegra" /proc/device-tree/model 2>/dev/null; then
    echo -e "${RED}This script is designed for NVIDIA Jetson devices.${NC}"
    echo -e "${YELLOW}For other hardware, use: ./setup-ollama.sh${NC}"
    exit 1
fi

# Detect Jetson model
JETSON_MODEL="Unknown"
if [[ -f /proc/device-tree/model ]]; then
    JETSON_MODEL=$(cat /proc/device-tree/model | tr -d '\0')
fi
echo -e "${GREEN}Detected: ${JETSON_MODEL}${NC}"

# Get memory info
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_MEM_GB=$((TOTAL_MEM_KB / 1024 / 1024))
echo -e "Total Memory: ${TOTAL_MEM_GB}GB"

# Determine Jetson tier
JETSON_TIER="nano"
if [[ "$JETSON_MODEL" == *"Orin"* ]]; then
    JETSON_TIER="orin"
elif [[ "$JETSON_MODEL" == *"Xavier"* ]]; then
    JETSON_TIER="xavier"
elif [[ "$JETSON_MODEL" == *"Nano"* ]]; then
    JETSON_TIER="nano"
fi

echo -e "Jetson Tier: ${JETSON_TIER}"
echo ""

# Check JetPack version
if command -v jetson_release &> /dev/null; then
    echo -e "${BLUE}JetPack Info:${NC}"
    jetson_release
    echo ""
fi

# System optimizations for Jetson
echo -e "${YELLOW}Applying Jetson optimizations...${NC}"

# Set to max performance mode
if [[ -f /usr/bin/jetson_clocks ]]; then
    echo -e "Setting max clock speeds..."
    sudo jetson_clocks --store
    sudo jetson_clocks
    echo -e "${GREEN}✓ Clocks set to maximum${NC}"
fi

# Increase swap for larger models
SWAP_SIZE_GB=8
if [[ "$JETSON_TIER" == "orin" ]]; then
    SWAP_SIZE_GB=16
fi

CURRENT_SWAP=$(free -g | awk '/^Swap:/{print $2}')
if [[ $CURRENT_SWAP -lt $SWAP_SIZE_GB ]]; then
    echo -e "Creating ${SWAP_SIZE_GB}GB swap file..."
    sudo fallocate -l ${SWAP_SIZE_GB}G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1G count=${SWAP_SIZE_GB}
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo -e "${GREEN}✓ Swap configured${NC}"
fi

# Install Ollama (ARM64)
echo ""
echo -e "${YELLOW}Installing Ollama for ARM64...${NC}"

if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✓ Ollama already installed${NC}"
else
    curl -fsSL https://ollama.com/install.sh | sh
    echo -e "${GREEN}✓ Ollama installed${NC}"
fi

# Start Ollama
if ! pgrep -x "ollama" > /dev/null; then
    echo -e "Starting Ollama service..."
    ollama serve &
    sleep 5
fi

# Select models based on Jetson tier
echo ""
echo -e "${BLUE}Selecting models for ${JETSON_TIER}...${NC}"

case $JETSON_TIER in
    orin)
        CHAT_MODEL="llama3.2:3b"
        CODE_MODEL="qwen2.5-coder:7b"
        ;;
    xavier)
        CHAT_MODEL="llama3.2:3b"
        CODE_MODEL="qwen2.5-coder:3b"
        ;;
    nano)
        CHAT_MODEL="llama3.2:1b"
        CODE_MODEL="qwen2.5-coder:1.5b"
        ;;
esac

EMBED_MODEL="nomic-embed-text"

echo -e "  Chat: ${CHAT_MODEL}"
echo -e "  Code: ${CODE_MODEL}"
echo -e "  Embed: ${EMBED_MODEL}"
echo ""

# Pull models
echo -e "${YELLOW}Pulling models (this may take a while on Jetson)...${NC}"

for MODEL in $CHAT_MODEL $CODE_MODEL $EMBED_MODEL; do
    echo -e "${BLUE}Pulling ${MODEL}...${NC}"
    ollama pull $MODEL
done

# Configure Ollama for Jetson
echo ""
echo -e "${YELLOW}Configuring Ollama for Jetson...${NC}"

# Create systemd override for Jetson-specific settings
sudo mkdir -p /etc/systemd/system/ollama.service.d/
cat << EOF | sudo tee /etc/systemd/system/ollama.service.d/jetson.conf
[Service]
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="CUDA_VISIBLE_DEVICES=0"
EOF

sudo systemctl daemon-reload
sudo systemctl restart ollama

echo -e "${GREEN}✓ Ollama configured for Jetson${NC}"

# Test inference
echo ""
echo -e "${BLUE}Testing inference...${NC}"

START_TIME=$(date +%s.%N)
RESPONSE=$(ollama run $CHAT_MODEL "Say hello in 5 words or less" 2>/dev/null | head -1)
END_TIME=$(date +%s.%N)
LATENCY=$(echo "$END_TIME - $START_TIME" | bc)

echo -e "Response: ${RESPONSE}"
echo -e "Latency: ${LATENCY}s"

if (( $(echo "$LATENCY < 10" | bc -l) )); then
    echo -e "${GREEN}✓ Inference speed is acceptable${NC}"
else
    echo -e "${YELLOW}⚠ Inference may be slow, consider smaller models${NC}"
fi

# Write Jetson-specific config
CONFIG_DIR="${HOME}/.studylog"
mkdir -p "$CONFIG_DIR"

cat > "${CONFIG_DIR}/ollama.json" << EOF
{
  "tier": "edge",
  "jetson": {
    "model": "${JETSON_MODEL}",
    "tier": "${JETSON_TIER}",
    "memoryGb": ${TOTAL_MEM_GB}
  },
  "host": "http://127.0.0.1:11434",
  "models": {
    "chat": "${CHAT_MODEL}",
    "code": "${CODE_MODEL}",
    "embed": "${EMBED_MODEL}"
  },
  "optimizations": {
    "numParallel": 1,
    "maxLoadedModels": 1,
    "useGpuLayers": true
  },
  "installedAt": "$(date -Iseconds)"
}
EOF

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Jetson Setup Complete!             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "Configuration: ${CONFIG_DIR}/ollama.json"
echo ""
echo -e "${YELLOW}Jetson Tips:${NC}"
echo -e "  • Keep only one model loaded at a time"
echo -e "  • Use 'sudo jetson_clocks' before heavy inference"
echo -e "  • Monitor temps with 'tegrastats'"
echo -e "  • Consider nvme storage for faster model loading"

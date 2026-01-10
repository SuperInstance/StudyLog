#!/bin/bash
# StudyLoG.AI - Ollama Setup Script
# Installs Ollama and downloads appropriate models based on hardware

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     StudyLoG.AI - Ollama Setup         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    OS="windows"
fi

echo -e "${YELLOW}Detected OS: ${OS}${NC}"

# Check if Ollama is already installed
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✓ Ollama is already installed${NC}"
    ollama --version
else
    echo -e "${YELLOW}Installing Ollama...${NC}"

    if [[ "$OS" == "linux" ]]; then
        curl -fsSL https://ollama.com/install.sh | sh
    elif [[ "$OS" == "macos" ]]; then
        # Check for Homebrew
        if command -v brew &> /dev/null; then
            brew install ollama
        else
            curl -fsSL https://ollama.com/install.sh | sh
        fi
    else
        echo -e "${RED}Please install Ollama manually from https://ollama.com${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Ollama installed${NC}"
fi

# Start Ollama service if not running
if ! pgrep -x "ollama" > /dev/null; then
    echo -e "${YELLOW}Starting Ollama service...${NC}"
    ollama serve &
    sleep 3
fi

# Detect hardware
echo ""
echo -e "${BLUE}Detecting hardware...${NC}"

VRAM_MB=0
RAM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || sysctl -n hw.memsize 2>/dev/null | awk '{print int($1/1024/1024)}' || echo 8192)
IS_JETSON=false
HAS_NVIDIA=false

# Check for NVIDIA GPU
if command -v nvidia-smi &> /dev/null; then
    HAS_NVIDIA=true
    VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1 | tr -d ' ')
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
    echo -e "${GREEN}✓ NVIDIA GPU detected: ${GPU_NAME} (${VRAM_MB}MB VRAM)${NC}"

    # Check if Jetson
    if [[ "$GPU_NAME" == *"Tegra"* ]] || [[ "$GPU_NAME" == *"Jetson"* ]] || [[ -f /etc/nv_tegra_release ]]; then
        IS_JETSON=true
        echo -e "${GREEN}✓ Jetson device detected${NC}"
    fi
else
    echo -e "${YELLOW}No NVIDIA GPU detected, using CPU mode${NC}"
fi

echo -e "RAM: ${RAM_MB}MB"

# Determine tier
TIER="starter"
if [[ $VRAM_MB -ge 48000 ]]; then
    TIER="pro"
elif [[ $VRAM_MB -ge 16000 ]]; then
    TIER="power"
elif [[ $VRAM_MB -ge 8000 ]] || [[ "$IS_JETSON" == true ]]; then
    TIER="edge"
elif [[ $VRAM_MB -ge 4000 ]]; then
    TIER="maker"
fi

echo ""
echo -e "${GREEN}Hardware Tier: ${TIER}${NC}"

# Define models for each tier
declare -A CHAT_MODELS
declare -A CODE_MODELS
declare -A EMBED_MODELS

CHAT_MODELS[starter]="llama3.2:3b"
CHAT_MODELS[maker]="llama3.2:3b"
CHAT_MODELS[edge]="llama3.2:3b"
CHAT_MODELS[power]="llama3.2:3b"
CHAT_MODELS[pro]="llama3.2:3b"

CODE_MODELS[starter]="qwen2.5-coder:3b"
CODE_MODELS[maker]="qwen2.5-coder:7b"
CODE_MODELS[edge]="qwen2.5-coder:7b"
CODE_MODELS[power]="codestral"
CODE_MODELS[pro]="qwen2.5-coder:32b"

EMBED_MODELS[starter]="nomic-embed-text"
EMBED_MODELS[maker]="nomic-embed-text"
EMBED_MODELS[edge]="nomic-embed-text"
EMBED_MODELS[power]="nomic-embed-text"
EMBED_MODELS[pro]="nomic-embed-text"

CHAT_MODEL=${CHAT_MODELS[$TIER]}
CODE_MODEL=${CODE_MODELS[$TIER]}
EMBED_MODEL=${EMBED_MODELS[$TIER]}

echo ""
echo -e "${BLUE}Models to install:${NC}"
echo -e "  Chat: ${CHAT_MODEL}"
echo -e "  Code: ${CODE_MODEL}"
echo -e "  Embed: ${EMBED_MODEL}"
echo ""

# Ask for confirmation
read -p "Install these models? [Y/n] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ ! -z $REPLY ]]; then
    echo "Installation cancelled."
    exit 0
fi

# Pull models
echo ""
echo -e "${YELLOW}Pulling models (this may take a while)...${NC}"

echo -e "${BLUE}Pulling ${CHAT_MODEL}...${NC}"
ollama pull $CHAT_MODEL

echo -e "${BLUE}Pulling ${CODE_MODEL}...${NC}"
ollama pull $CODE_MODEL

echo -e "${BLUE}Pulling ${EMBED_MODEL}...${NC}"
ollama pull $EMBED_MODEL

# Verify installation
echo ""
echo -e "${BLUE}Installed models:${NC}"
ollama list

# Test models
echo ""
echo -e "${BLUE}Testing models...${NC}"

echo -e "${YELLOW}Testing chat model...${NC}"
RESPONSE=$(ollama run $CHAT_MODEL "Say 'Hello from StudyLoG!' in exactly those words." 2>/dev/null | head -1)
if [[ "$RESPONSE" == *"Hello"* ]]; then
    echo -e "${GREEN}✓ Chat model working${NC}"
else
    echo -e "${RED}✗ Chat model test failed${NC}"
fi

echo -e "${YELLOW}Testing code model...${NC}"
RESPONSE=$(ollama run $CODE_MODEL "Write a Python hello world in one line" 2>/dev/null | head -1)
if [[ "$RESPONSE" == *"print"* ]]; then
    echo -e "${GREEN}✓ Code model working${NC}"
else
    echo -e "${RED}✗ Code model test failed${NC}"
fi

# Write config file
CONFIG_DIR="${HOME}/.studylog"
mkdir -p "$CONFIG_DIR"

cat > "${CONFIG_DIR}/ollama.json" << EOF
{
  "tier": "${TIER}",
  "host": "http://127.0.0.1:11434",
  "models": {
    "chat": "${CHAT_MODEL}",
    "code": "${CODE_MODEL}",
    "embed": "${EMBED_MODEL}"
  },
  "hardware": {
    "vramMb": ${VRAM_MB},
    "ramMb": ${RAM_MB},
    "hasNvidia": ${HAS_NVIDIA},
    "isJetson": ${IS_JETSON}
  },
  "installedAt": "$(date -Iseconds)"
}
EOF

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Setup Complete!                    ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "Configuration saved to: ${CONFIG_DIR}/ollama.json"
echo ""
echo -e "To test manually:"
echo -e "  ollama run ${CHAT_MODEL} \"Hello!\""
echo ""
echo -e "Ollama API available at: http://127.0.0.1:11434"

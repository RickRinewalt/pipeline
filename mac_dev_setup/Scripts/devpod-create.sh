#!/bin/bash

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
REVERSE='\033[7m'

# Directories
TEMPLATES_DIR="/Users/chris/devpods/_templates"
DEVPODS_DIR="/Users/chris/devpods"

# Show loading message
echo "Loading DevPod templates..."

# Check if templates directory exists
if [ ! -d "$TEMPLATES_DIR" ]; then
    echo -e "${RED}Templates directory not found: $TEMPLATES_DIR${NC}"
    echo "Please create the directory and add workspace templates."
    exit 1
fi

# Get list of templates
templates=($(ls -d "$TEMPLATES_DIR"/*/ 2>/dev/null | xargs -n 1 basename))

if [ ${#templates[@]} -eq 0 ]; then
    echo -e "${RED}No templates found in $TEMPLATES_DIR${NC}"
    exit 1
fi

# Function to display template menu
display_template_menu() {
    clear
    echo "Select a workspace template:"
    echo "----------------------------"
    for i in "${!templates[@]}"; do
        if [ $i -eq $selected ]; then
            echo -e "${REVERSE}$((i+1)). ${templates[$i]}${NC}"
        else
            echo "$((i+1)). ${templates[$i]}"
        fi
    done
    echo ""
    echo "Use arrow keys or number keys to select, Enter to confirm, q to quit"
}

# Function to display provider menu
display_provider_menu() {
    clear
    echo "Select a DevPod provider:"
    echo "------------------------"
    for i in "${!providers[@]}"; do
        if [ $i -eq $selected ]; then
            echo -e "${REVERSE}$((i+1)). ${providers[$i]}${NC}"
        else
            echo "$((i+1)). ${providers[$i]}"
        fi
    done
    echo ""
    echo "Use arrow keys or number keys to select, Enter to confirm, q to quit"
}

# Function to display IDE menu
display_ide_menu() {
    clear
    echo "Select an IDE (press Enter for VS Code):"
    echo "----------------------------------------"
    for i in "${!ides[@]}"; do
        if [ $i -eq $selected ]; then
            if [ $i -eq 0 ]; then
                echo -e "${REVERSE}$((i+1)). ${ides[$i]} (default)${NC}"
            else
                echo -e "${REVERSE}$((i+1)). ${ides[$i]}${NC}"
            fi
        else
            if [ $i -eq 0 ]; then
                echo "$((i+1)). ${ides[$i]} (default)"
            else
                echo "$((i+1)). ${ides[$i]}"
            fi
        fi
    done
    echo ""
    echo "Use arrow keys or number keys to select, Enter to confirm, q to quit"
}

# Function to handle menu navigation
navigate_menu() {
    menu_type=$1
    
    selected=0
    while true; do
        case $menu_type in
            "template")
                display_template_menu
                items_count=${#templates[@]}
                ;;
            "provider")
                display_provider_menu
                items_count=${#providers[@]}
                ;;
            "ide")
                display_ide_menu
                items_count=${#ides[@]}
                ;;
        esac
        
        # Read user input
        read -rsn1 input
        
        # Handle arrow keys (escape sequences)
        if [[ $input == $'\x1b' ]]; then
            read -rsn2 input
            case $input in
                '[A') # Up arrow
                    ((selected--))
                    if [ $selected -lt 0 ]; then
                        selected=$((items_count - 1))
                    fi
                    ;;
                '[B') # Down arrow
                    ((selected++))
                    if [ $selected -ge $items_count ]; then
                        selected=0
                    fi
                    ;;
            esac
        elif [[ $input =~ ^[0-9]$ ]]; then
            # Number key pressed
            num=$((input - 1))
            if [ $num -ge 0 ] && [ $num -lt $items_count ]; then
                selected=$num
                return $selected
            fi
        elif [[ $input == "" ]]; then
            # Enter key pressed
            return $selected
        elif [[ $input == "q" ]] || [[ $input == "Q" ]]; then
            # Quit
            clear
            echo "Exiting..."
            exit 0
        fi
    done
}

# Select template
navigate_menu "template"
template_index=$?
selected_template="${templates[$template_index]}"

# Get list of providers
echo "Fetching available providers..."
providers=($(devpod provider list --output json | jq -r 'keys[]' 2>/dev/null))

if [ ${#providers[@]} -eq 0 ]; then
    echo -e "${RED}No providers found. Please configure a provider first.${NC}"
    exit 1
fi

# Select provider
navigate_menu "provider"
provider_index=$?
selected_provider="${providers[$provider_index]}"

# IDE options
ides=("vscode" "vscode-insiders" "openvscode" "none")

# Select IDE
navigate_menu "ide"
ide_index=$?
selected_ide="${ides[$ide_index]}"

# Get devpod name
clear
echo "Creating new DevPod"
echo "==================="
echo ""
echo -e "Template: ${GREEN}${selected_template}${NC}"
echo -e "Provider: ${GREEN}${selected_provider}${NC}"
echo -e "IDE: ${GREEN}${selected_ide}${NC}"
echo ""
read -p "Enter a name for your DevPod: " devpod_name

# Validate name
if [[ -z "$devpod_name" ]]; then
    echo -e "${RED}DevPod name cannot be empty.${NC}"
    exit 1
fi

# Check if devpod already exists
if devpod list --output json | jq -r '.[].id' | grep -q "^${devpod_name}$"; then
    echo -e "${RED}DevPod '${devpod_name}' already exists.${NC}"
    exit 1
fi

# Copy template to devpods directory
echo ""
echo "Copying template..."
template_source="$TEMPLATES_DIR/$selected_template"
devpod_workspace="$DEVPODS_DIR/$devpod_name"

cp -r "$template_source" "$devpod_workspace"
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to copy template.${NC}"
    exit 1
fi

echo -e "${GREEN}Template copied successfully.${NC}"

# Create the devpod
echo ""
echo "Creating DevPod '${devpod_name}'..."

# Build devpod command
devpod_cmd="devpod up ${devpod_name} --source local:${devpod_workspace} --provider ${selected_provider}"

if [ "$selected_ide" != "none" ]; then
    devpod_cmd="$devpod_cmd --ide ${selected_ide}"
fi

# Execute devpod creation
eval $devpod_cmd

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}DevPod '${devpod_name}' created successfully!${NC}"
    echo ""
    echo "Connecting to DevPod..."
    sleep 2
    devpod ssh ${devpod_name}
else
    echo -e "${RED}Failed to create DevPod.${NC}"
    # Clean up copied workspace on failure
    rm -rf "$devpod_workspace"
    exit 1
fi

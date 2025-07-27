#!/bin/bash

# Show loading message
echo "Loading DevPods..."

# Get list of devpods sorted by creation time (newest first)
devpod_data=$(devpod list --output json 2>/dev/null | jq 'sort_by(.creationTimestamp) | reverse')
devpods=($(echo "$devpod_data" | jq -r '.[].id'))

# Get status for each devpod
statuses=()
for i in "${!devpods[@]}"; do
    pod="${devpods[$i]}"
    echo -ne "\rChecking status... ($((i+1))/${#devpods[@]})"
    status_output=$(devpod status "$pod" 2>&1)
    if [[ $status_output =~ is\ \'([^\']+)\' ]]; then
        statuses+=("${BASH_REMATCH[1]}")
    else
        statuses+=("Unknown")
    fi
done

if [ ${#devpods[@]} -eq 0 ]; then
    echo "No devpods found."
    exit 1
fi

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
REVERSE='\033[7m'

# Function to get status color
get_status_color() {
    case "$1" in
        "Running")
            echo -e "${GREEN}●${NC}"
            ;;
        "Stopped")
            echo -e "${RED}●${NC}"
            ;;
        "Busy")
            echo -e "${YELLOW}●${NC}"
            ;;
        *)
            echo -e "${BLUE}●${NC}"
            ;;
    esac
}

# Function to display the menu
display_menu() {
    clear
    echo "Select a DevPod to SSH into:"
    echo "----------------------------"
    for i in "${!devpods[@]}"; do
        status_icon=$(get_status_color "${statuses[$i]}")
        status_text="${statuses[$i]}"
        
        # Format status text with color
        case "${statuses[$i]}" in
            "Running")
                status_display="${GREEN}${status_text}${NC}"
                ;;
            "Stopped")
                status_display="${RED}${status_text}${NC}"
                ;;
            "Busy")
                status_display="${YELLOW}${status_text}${NC}"
                ;;
            *)
                status_display="${BLUE}${status_text}${NC}"
                ;;
        esac
        
        if [ $i -eq $selected ]; then
            echo -e "${REVERSE}$((i+1)). ${status_icon} ${devpods[$i]} (${status_display}${REVERSE})${NC}"
        else
            echo -e "$((i+1)). ${status_icon} ${devpods[$i]} (${status_display})"
        fi
    done
    echo ""
    echo "Use arrow keys or number keys to select, Enter to connect, s to stop, d to delete, q to quit"
}

# Initialize selection
selected=0

# Main loop
while true; do
    display_menu
    
    # Read user input
    read -rsn1 input
    
    # Handle arrow keys (escape sequences)
    if [[ $input == $'\x1b' ]]; then
        read -rsn2 input
        case $input in
            '[A') # Up arrow
                ((selected--))
                if [ $selected -lt 0 ]; then
                    selected=$((${#devpods[@]} - 1))
                fi
                ;;
            '[B') # Down arrow
                ((selected++))
                if [ $selected -ge ${#devpods[@]} ]; then
                    selected=0
                fi
                ;;
        esac
    elif [[ $input =~ ^[0-9]$ ]]; then
        # Number key pressed
        num=$((input - 1))
        if [ $num -ge 0 ] && [ $num -lt ${#devpods[@]} ]; then
            selected=$num
            # Auto-connect when number is pressed
            clear
            echo "Connecting to ${devpods[$selected]}..."
            devpod ssh ${devpods[$selected]}
            exit 0
        fi
    elif [[ $input == "" ]]; then
        # Enter key pressed
        clear
        echo "Connecting to ${devpods[$selected]}..."
        devpod ssh ${devpods[$selected]}
        exit 0
    elif [[ $input == "s" ]] || [[ $input == "S" ]]; then
        # Stop selected devpod
        if [[ "${statuses[$selected]}" == "Stopped" ]]; then
            clear
            echo "DevPod '${devpods[$selected]}' is already stopped."
            echo "Press any key to continue..."
            read -rsn1
        else
            clear
            echo "Are you sure you want to stop '${devpods[$selected]}'? (y/N)"
            read -rsn1 confirm
            if [[ $confirm == "y" ]] || [[ $confirm == "Y" ]]; then
                echo ""
                echo "Stopping ${devpods[$selected]}..."
                devpod stop ${devpods[$selected]}
                if [ $? -eq 0 ]; then
                    echo "DevPod stopped successfully."
                    # Update status
                    statuses[$selected]="Stopped"
                else
                    echo "Failed to stop DevPod."
                fi
                echo "Press any key to continue..."
                read -rsn1
            fi
        fi
    elif [[ $input == "d" ]] || [[ $input == "D" ]]; then
        # Delete selected devpod
        clear
        echo "WARNING: This will permanently delete '${devpods[$selected]}' and all its data!"
        echo ""
        echo "To confirm deletion, type the exact name of the devpod: ${devpods[$selected]}"
        echo "Type anything else or press Enter to cancel."
        echo ""
        read -p "Confirm deletion: " confirm_name
        if [[ "$confirm_name" == "${devpods[$selected]}" ]]; then
            echo ""
            echo "Deleting ${devpods[$selected]}..."
            devpod delete ${devpods[$selected]} --force
            if [ $? -eq 0 ]; then
                echo "DevPod deleted successfully."
                # Remove from arrays and refresh
                unset devpods[$selected]
                unset statuses[$selected]
                # Reindex arrays
                devpods=("${devpods[@]}")
                statuses=("${statuses[@]}")
                # Adjust selected index if necessary
                if [ $selected -ge ${#devpods[@]} ] && [ ${#devpods[@]} -gt 0 ]; then
                    selected=$((${#devpods[@]} - 1))
                elif [ ${#devpods[@]} -eq 0 ]; then
                    clear
                    echo "No more devpods available."
                    exit 0
                fi
            else
                echo "Failed to delete DevPod."
            fi
            echo "Press any key to continue..."
            read -rsn1
        else
            echo ""
            echo "Deletion cancelled."
            echo "Press any key to continue..."
            read -rsn1
        fi
    elif [[ $input == "q" ]] || [[ $input == "Q" ]]; then
        # Quit
        clear
        echo "Exiting..."
        exit 0
    fi
done
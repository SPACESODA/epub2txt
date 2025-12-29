#!/bin/bash

# Define the virtual environment directory
VENV_DIR=".venv"

# Check if the virtual environment exists
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    
    # Activate and install requirements
    source "$VENV_DIR/bin/activate"
    
    if [ -f "requirements.txt" ]; then
        echo "Installing requirements..."
        pip install -r requirements.txt
    else
        echo "Warning: requirements.txt not found. Please ensure dependencies are installed."
    fi
else
    # Activate if it already exists
    source "$VENV_DIR/bin/activate"
fi

# Run the main script with all arguments passed to this script
python3 epub2txt.py "$@"

# Deactivate (optional, as the script ends anyway)
deactivate

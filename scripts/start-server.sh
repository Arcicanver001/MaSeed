#!/bin/bash
# Start a local web server for Smart Greenhouse Dashboard
# This script tries multiple methods to start a web server

echo "========================================"
echo "Smart Greenhouse Dashboard Server"
echo "========================================"
echo ""

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo "Starting server with Python..."
    echo "Dashboard will be available at: http://localhost:8000"
    echo "Press Ctrl+C to stop the server"
    echo ""
    python3 -m http.server 8000
    exit 0
fi

# Check if Python 2 is available
if command -v python &> /dev/null; then
    echo "Starting server with Python..."
    echo "Dashboard will be available at: http://localhost:8000"
    echo "Press Ctrl+C to stop the server"
    echo ""
    python -m SimpleHTTPServer 8000
    exit 0
fi

# Check if Node.js is available
if command -v node &> /dev/null; then
    echo "Python not found. Starting server with Node.js..."
    echo "Dashboard will be available at: http://localhost:8000"
    echo "Press Ctrl+C to stop the server"
    echo ""
    npx -y serve -p 8000
    exit 0
fi

# Check if PHP is available
if command -v php &> /dev/null; then
    echo "Python and Node.js not found. Starting server with PHP..."
    echo "Dashboard will be available at: http://localhost:8000"
    echo "Press Ctrl+C to stop the server"
    echo ""
    php -S localhost:8000
    exit 0
fi

# No server found
echo "ERROR: No suitable web server found!"
echo ""
echo "Please install one of the following:"
echo "  - Python 3: sudo apt-get install python3"
echo "  - Node.js: sudo apt-get install nodejs npm"
echo "  - PHP: sudo apt-get install php"
echo ""
echo "Or simply open index.html directly in your browser."
echo ""


# Benchmark Requirements

This folder contains benchmark scripts that require the `wrk` HTTP benchmarking tool.

## Installation Instructions

### macOS

```bash
brew install wrk
```

### Linux

```bash
sudo apt-get install wrk
# or use your package manager (yum, dnf, pacman, etc.)
```

### Windows

`wrk` does not natively support Windows. You have the following options:

#### Option 1: Use WSL (Windows Subsystem for Linux) - Recommended

1. Install WSL:

   ```powershell
   wsl --install
   ```

2. Open WSL terminal and install wrk:

   ```bash
   sudo apt-get update
   sudo apt-get install wrk
   ```

3. Run benchmarks from WSL or set `WRK_PATH` environment variable:
   ```powershell
   set WRK_PATH=wsl wrk
   ```

#### Option 2: Use Alternative Tools

**autocannon** (Node.js-based, cross-platform):

```bash
npm install -g autocannon
```

Then set `WRK_PATH`:

```powershell
set WRK_PATH=autocannon
```

**Apache Bench (ab)**:

- Install Apache HTTP Server which includes `ab` tool
- Set `WRK_PATH` to point to the `ab` executable

## Environment Variables

You can customize the benchmark tool using environment variables:

- `WRK_PATH`: Path to the wrk executable (default: `wrk`)
- `PORT`: Server port for benchmarks (default: `3000`)

Example:

```bash
export WRK_PATH=/usr/local/bin/wrk
export PORT=3000
npm run bench 10 false
```

## Usage

After installing `wrk`, you can run benchmarks:

```bash
# Single benchmark
npm run bench <factor> <useMiddleware>
npm run bench 10 false

# Run all benchmarks
npm run bench:all
```

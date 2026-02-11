// WinClaw native exe shim.
// Allows running "winclaw" without .cmd extension on Windows.
// Build: go build -ldflags "-s -w" -o winclaw.exe ./scripts/windows-shim/
package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

func main() {
	dir, err := filepath.Abs(filepath.Dir(os.Args[0]))
	if err != nil {
		os.Stderr.WriteString("Failed to resolve install dir: " + err.Error() + "\n")
		os.Exit(1)
	}

	node := filepath.Join(dir, "node", "node.exe")
	app := filepath.Join(dir, "app", "openclaw.mjs")
	args := append([]string{app}, os.Args[1:]...)

	cmd := exec.Command(node, args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: false}

	if err := cmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			os.Exit(exitErr.ExitCode())
		}
		os.Exit(1)
	}
}

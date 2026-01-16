// Package main is the entry point for the Robot Agent.
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/datapilot/chainkvm/robot-agent/config"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	log.Printf("starting robot agent: robot_id=%s", cfg.RobotID)

	// TODO: Initialize components
	// - Video module
	// - Session manager
	// - Safety subsystem
	// - WebRTC transport

	// Wait for shutdown signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigCh:
		log.Printf("received signal %v, shutting down", sig)
	case <-ctx.Done():
		log.Printf("context cancelled, shutting down")
	}

	// TODO: Graceful shutdown
}

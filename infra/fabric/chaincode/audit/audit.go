// Package audit provides the ChainKVM audit trail chaincode.
package audit

import (
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// Contract implements the audit trail smart contract.
type Contract struct {
	contractapi.Contract
}

// TODO: Implement in M4-002
// - RecordSessionStarted
// - RecordSessionEnded
// - RecordPrivilegedAction
// - RecordTokenRevoked
// - QueryBySessionID
// - QueryByTimeRange

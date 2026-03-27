// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ReputationManager.sol";
import "./VoterSelector.sol";

contract Auth is ReputationManager, VoterSelector{

    // Enum để định nghĩa role
    enum Role {
        NONE,     // 0: chưa đăng ký
        CLIENT,   // 1: người thuê
        WORKER    // 2: người làm
    }

    // Lưu role của từng address
    mapping(address => Role) public roles;

    // 1. REGISTER CLIENT
    function registerClient() external {
        require(roles[msg.sender] == Role.NONE, "Already registered");

        roles[msg.sender] = Role.CLIENT;
        _initScore(msg.sender);
        _registerUser(msg.sender);
    }

    // 2. REGISTER WORKER
    function registerWorker() external {
        require(roles[msg.sender] == Role.NONE, "Already registered");

        roles[msg.sender] = Role.WORKER;
        _initScore(msg.sender);
        _registerUser(msg.sender);
    }

    // 3. CHECK ROLE 
    function getMyRole() external view returns (Role) {
        return roles[msg.sender];
    }
}
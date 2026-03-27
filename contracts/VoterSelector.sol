// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ReputationManager.sol";

contract VoterSelector is ReputationManager {

    // Danh sách toàn bộ user đã đăng ký (thêm vào khi register)
    address[] internal _allUsers;

    // Tránh thêm trùng
    mapping(address => bool) private _isRegistered;

    // Gọi từ Auth khi register
    function _registerUser(address user) internal {
        if (!_isRegistered[user]) {
            _allUsers.push(user);
            _isRegistered[user] = true;
        }
    }

    // Chọn tối đa maxCount voter đủ điều kiện, loại trừ 2 bên tranh chấp
    function _selectVoters(
        address excludeA,   // client của job
        address excludeB,   // worker của job
        uint256 seed,       // số ngẫu nhiên seed (từ block data)
        uint8   maxCount    // thường là 5
    ) internal view returns (address[] memory) {

        // Bước 1: lọc danh sách eligible
        address[] memory pool = new address[](_allUsers.length);
        uint256 poolSize = 0;

        for (uint256 i = 0; i < _allUsers.length; i++) {
            address u = _allUsers[i];
            if (
                u != excludeA &&
                u != excludeB &&
                isEligibleVoter(u)   // score >= 80, từ ReputationManager
            ) {
                pool[poolSize] = u;
                poolSize++;
            }
        }

        // Bước 2: xác định số voter thực tế có thể chọn
        uint8 count = poolSize < maxCount
            ? uint8(poolSize)
            : maxCount;

        address[] memory selected = new address[](count);

        // Bước 3: Fisher-Yates shuffle đơn giản dựa trên seed
        // Tạo bản copy để shuffle không ảnh hưởng pool gốc
        address[] memory shuffled = new address[](poolSize);
        for (uint256 i = 0; i < poolSize; i++) {
            shuffled[i] = pool[i];
        }

        for (uint256 i = 0; i < count; i++) {
            uint256 j = i + (uint256(keccak256(abi.encodePacked(seed, i))) % (poolSize - i));
            // swap
            address tmp  = shuffled[i];
            shuffled[i]  = shuffled[j];
            shuffled[j]  = tmp;
            selected[i]  = shuffled[i];
        }

        return selected;
    }
}
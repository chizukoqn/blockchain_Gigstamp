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

        // BẮT BUỘC: Đảm bảo số voter là số lẻ để tránh hòa
        if (count > 0 && count % 2 == 0) {
            count--;
        }

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

    // Chọn voter với danh sách loại trừ động (Client, Worker, và các voter đã có)
    function _selectVotersExtended(
        address[] memory excluded,
        uint256 seed,
        uint8 countToSelect
    ) internal view returns (address[] memory) {
        address[] memory pool = new address[](_allUsers.length);
        uint256 poolSize = 0;

        for (uint256 i = 0; i < _allUsers.length; i++) {
            address u = _allUsers[i];
            bool isExcluded = false;
            for (uint256 j = 0; j < excluded.length; j++) {
                if (u == excluded[j]) {
                    isExcluded = true;
                    break;
                }
            }

            if (!isExcluded && isEligibleVoter(u)) {
                pool[poolSize] = u;
                poolSize++;
            }
        }

        uint8 finalCount = poolSize < countToSelect ? uint8(poolSize) : countToSelect;
        // Đảm bảo số lẻ (nếu cần - tùy thuộc logic gọi nhưng _selectVotersExtended thường dùng để Replace)
        // Tuy nhiên Dispute chính yêu cầu số lẻ, nên nếu Replace để bù đắp, tổng số vẫn nên là lẻ.
        
        address[] memory selected = new address[](finalCount);
        address[] memory shuffled = new address[](poolSize);
        for (uint256 i = 0; i < poolSize; i++) shuffled[i] = pool[i];

        for (uint256 i = 0; i < finalCount; i++) {
            uint256 j = i + (uint256(keccak256(abi.encodePacked(seed, i))) % (poolSize - i));
            address tmp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = tmp;
            selected[i] = shuffled[i];
        }

        return selected;
    }
}
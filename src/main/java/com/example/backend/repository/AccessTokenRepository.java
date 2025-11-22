package com.example.backend.repository;

import com.example.backend.entity.AccessTokenEntity;
import com.example.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AccessTokenRepository extends JpaRepository<AccessTokenEntity, Long> {
    Optional<AccessTokenEntity> findByUserId(Long userId);
}
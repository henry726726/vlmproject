package com.example.backend.repository;

import com.example.backend.entity.AdContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.example.backend.entity.User;

import java.util.Optional;

// AdContent 엔티티를 위한 JPA 리포지토리
@Repository
public interface AdContentRepository extends JpaRepository<AdContent, Long> {
    Optional<AdContent> findFirstByUserEmailOrderByCreatedAtDesc(String userEmail);

}
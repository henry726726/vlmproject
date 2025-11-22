package com.example.backend.repository;

import com.example.backend.entity.AdInsight;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AdInsightRepository extends JpaRepository<AdInsight, Long> {
    Optional<AdInsight> findTopByAdIdOrderByDateDesc(String adId);
}

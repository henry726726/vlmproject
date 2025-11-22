package com.example.backend.repository;

import com.example.backend.entity.AdRun;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AdRunRepository extends JpaRepository<AdRun, Long> {
    List<AdRun> findByStatusAndAdModifiedAtBefore(String status, OffsetDateTime threshold);
}
package com.example.backend.repository;

import com.example.backend.entity.Ad;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdRepository extends JpaRepository<Ad, String> {
    boolean existsByAdId(String adId);
}

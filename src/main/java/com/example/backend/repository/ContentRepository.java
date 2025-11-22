package com.example.backend.repository;

import com.example.backend.entity.Content;
import org.springframework.data.jpa.repository.JpaRepository;

//JpaRepository<T, ID>를 상속하면 기본 CRUD 자동 지원
//콘텐츠 중복 방지를 위해 existsById() 직접 선언
public interface ContentRepository extends JpaRepository<Content, String> {
    boolean existsById(String id);
}

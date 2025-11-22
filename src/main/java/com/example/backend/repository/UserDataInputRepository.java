package com.example.backend.repository;

import com.example.backend.entity.UserDataInput;
import org.springframework.data.jpa.repository.JpaRepository;

//JpaRepository<T, ID>를 상속하면 기본 CRUD 자동 지원
public interface UserDataInputRepository extends JpaRepository<UserDataInput, String> {
}

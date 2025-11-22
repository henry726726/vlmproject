package com.example.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor // 기본 생성자
@AllArgsConstructor // 모든 필드(token, message)를 받는 생성자: LoginResponse(String token, String message)
public class LoginResponse {
    private String token;
    private String message;

    // 로그인 성공 시 토큰만 반환하는 편의 생성자
    public LoginResponse(String token) {
        this.token = token;
        this.message = null; // 성공 시 메시지는 null
    }

  
}
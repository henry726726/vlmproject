package com.example.backend.controller;

import com.example.backend.dto.LoginRequest;
import com.example.backend.dto.LoginResponse;
import com.example.backend.dto.SignupRequest;
import com.example.backend.service.AuthService;
import lombok.RequiredArgsConstructor;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// import java.util.Map; // Map을 사용하지 않으므로 이 줄은 삭제해도 됩니다.

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    // 회원가입 API
    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody SignupRequest request) {
        try {
            authService.signup(request);
            return ResponseEntity.ok(Map.of("message", "회원가입 성공"));
        } catch (IllegalArgumentException e) {
            // 회원가입 실패 시 409 Conflict 상태 코드와 메시지 반환
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }

    // 로그인 API
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        try {
            String token = authService.login(request);
            // 로그인 성공 시: 토큰만 담아서 반환 (LoginResponse의 편의 생성자 사용)
            return ResponseEntity.ok(new LoginResponse(token));
        } catch (IllegalArgumentException e) {
            // 로그인 실패 시: 토큰은 null로, 메시지만 담아서 반환
            // LoginResponse의 @AllArgsConstructor가 만든 생성자 (String token, String message)를 사용
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new LoginResponse(null, e.getMessage()));
        }
    }
}
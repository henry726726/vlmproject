package com.example.backend.controller;

import com.example.backend.entity.AccessTokenEntity;
import com.example.backend.entity.User;
import com.example.backend.repository.AccessTokenRepository;
import com.example.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AccessTokenController {

    private final AccessTokenRepository accessTokenRepository;
    private final UserRepository userRepository;

    @PostMapping("/access-token")
    public ResponseEntity<String> saveAccessToken(
            @RequestBody Map<String, String> body,
            Authentication authentication //  변경: JWT 인증 정보 받기
    ) {
        // 1. 로그인 여부 확인
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(" 로그인 상태가 아닙니다.");
        }

        // 2. 이메일(=username) 추출
        String email = authentication.getName();

        // 3. DB에서 User 조회
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException(" 유저를 찾을 수 없습니다."));

        // 4. 액세스토큰 값 확인
        String token = body.get("accessToken");
        if (token == null || token.isEmpty()) {
            return ResponseEntity.badRequest().body(" accessToken 값이 비어있음");
        }

        // 5. 기존 엔티티 조회 또는 새로 생성
        AccessTokenEntity entity = accessTokenRepository.findByUserId(user.getId())
                .orElse(null);
        if (entity == null) {
            entity = AccessTokenEntity.builder()
                    .user(user)
                    .accessToken(token)
                    .build();
        } else {
            entity.setAccessToken(token);
        }

        // 6. 저장
        accessTokenRepository.save(entity);

        return ResponseEntity.ok(" 액세스토큰 저장 완료");
    }

    @GetMapping("/access-token/{userId}")
public ResponseEntity<String> getAccessToken(@PathVariable Long userId) {
    return accessTokenRepository.findByUserId(userId)
            .map(AccessTokenEntity::getAccessToken)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(" 해당 유저의 액세스토큰이 없습니다."));
}
}

package com.example.backend.controller;

import com.example.backend.dto.UserInfoResponse;
import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository; // 👈 리포지토리 임포트
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/user") // 기존 경로 유지 (/user)
public class UserController {

    // 👇 DB 저장을 위해 Repository 추가
    private final UserRepository userRepository;

    @Autowired
    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // [기존] 내 정보 조회
    @GetMapping("/me")
    public ResponseEntity<?> getMyInfo(@AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "인증되지 않은 사용자입니다."));
        }

        // DB에서 최신 정보 조회 (bio 포함)
        User user = userRepository.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        
        // 💡 중요: UserInfoResponse DTO에도 bio 필드를 추가하거나, 
        // 여기서 Map으로 리턴해서 프론트엔드가 bio를 받을 수 있게 해야 합니다.
        // 편의상 여기서는 Map으로 반환하겠습니다.
        return ResponseEntity.ok(Map.of(
            "email", user.getEmail(),
            "nickname", user.getNickname(),
            "roles", user.getRoles(),
            "bio", user.getBio() != null ? user.getBio() : "" // null 방지
        ));
    }

    // 👇 [추가] 내 정보 수정 (PUT /user/me)
    @PutMapping("/me")
    public ResponseEntity<?> updateMyInfo(@AuthenticationPrincipal UserDetails userDetails,
                                          @RequestBody Map<String, String> request) { // DTO 대신 Map으로 간단히 받기
        if (userDetails == null) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다."));
        }

        try {
            // 1. 현재 로그인한 사용자 찾기
            User user = userRepository.findByEmail(userDetails.getUsername())
                    .orElseThrow(() -> new UsernameNotFoundException("사용자를 찾을 수 없습니다."));

            // 2. 요청된 데이터로 업데이트
            if (request.containsKey("nickname")) {
                user.setNickname(request.get("nickname"));
            }
            if (request.containsKey("bio")) {
                user.setBio(request.get("bio"));
            }
            // 이메일 변경은 보통 별도 인증이 필요하므로 여기서는 제외하거나 필요시 추가

            // 3. 저장
            userRepository.save(user);

            return ResponseEntity.ok(Map.of("message", "정보가 수정되었습니다."));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "수정 실패: " + e.getMessage()));
        }
    }
}
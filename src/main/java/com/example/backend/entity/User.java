package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.Set;
import java.util.HashSet;

@Entity
@Getter // 이 어노테이션이 getEmail(), getNickname() 등을 만들어줘
@Setter
@NoArgsConstructor // 기본 생성자
@Table(name = "users") // MySQL의 'user'는 예약어일 수 있으니 'users'로 변경 추천
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false) // 이메일은 유니크하고 필수
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String nickname;

    // 사용자 권한 (예시: ROLE_USER, ROLE_ADMIN 등)
    // Spring Security에서 사용될 권한 정보야.
    @ElementCollection(fetch = FetchType.EAGER) // 즉시 로딩
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "role")
    private Set<String> roles = new HashSet<>(); // 기본 역할 설정 가능

    //  AuthService에서 사용하는 생성자  (email, password, nickname)
    public User(String email, String password, String nickname) {
        this.email = email;
        this.password = password;
        this.nickname = nickname;
        this.roles.add("ROLE_USER"); // 회원가입 시 기본적으로 'ROLE_USER' 권한 부여
    }
}
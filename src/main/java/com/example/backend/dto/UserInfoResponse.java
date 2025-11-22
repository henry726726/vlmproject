package com.example.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

@Getter
@AllArgsConstructor
public class UserInfoResponse {

    private String email;
    private Collection<? extends GrantedAuthority> authorities;
}
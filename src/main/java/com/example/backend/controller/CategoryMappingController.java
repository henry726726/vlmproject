package com.example.backend.controller;

import com.example.backend.service.CategoryMappingService;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.http.ResponseEntity;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CategoryMappingController {

    private final CategoryMappingService categoryMappingService;

    @GetMapping("/category-map")
    public ResponseEntity<String> mapCategory(@RequestParam String product) {
        String category = categoryMappingService.mapProductToCategory(product);
        return ResponseEntity.ok(category);
    }
}

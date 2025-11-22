package com.example.backend.service;

import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class CategoryMappingService {

    private final Map<String, String> productCategoryMap = new HashMap<>();

    public CategoryMappingService() {
        // 패션/쥬얼리
        productCategoryMap.put("목걸이", "Apparel / Fashion & Jewelry");
        productCategoryMap.put("반지", "Apparel / Fashion & Jewelry");
        productCategoryMap.put("귀걸이", "Apparel / Fashion & Jewelry");
        productCategoryMap.put("시계", "Apparel / Fashion & Jewelry");
        productCategoryMap.put("지갑", "Apparel / Fashion & Jewelry");

        // 기본값은 Business Services
    }

    public String mapProductToCategory(String product) {
        return productCategoryMap.entrySet().stream()
                .filter(entry -> product.contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse("Business Services"); // 매핑 실패 시 기본 카테고리
    }
}

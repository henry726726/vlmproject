package com.example.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/industry-ctr")
public class IndustryCTRController {

    @GetMapping
    public Map<String, Double> getIndustryCTR() {
        Map<String, Double> ctrMap = new HashMap<>();

        ctrMap.put("Animals & Pets", 1.87);
        ctrMap.put("Apparel / Fashion & Jewelry", 1.14);
        ctrMap.put("Arts & Entertainment", 2.59);
        ctrMap.put("Attorneys & Legal Services", 0.99);
        ctrMap.put("Automotive — For Sale", 1.02);
        ctrMap.put("Automotive — Repair, Service & Parts", 1.10);
        ctrMap.put("Beauty & Personal Care", 1.51);
        ctrMap.put("Business Services", 1.16);
        ctrMap.put("Career & Employment", 1.41);
        ctrMap.put("Dentists & Dental Services", 0.88);
        ctrMap.put("Education & Instruction", 1.21);
        ctrMap.put("Finance & Insurance", 0.85);
        ctrMap.put("Furniture", 1.21);
        ctrMap.put("Health & Fitness", 1.61);
        ctrMap.put("Home & Home Improvement", 1.26);
        ctrMap.put("Industrial & Commercial", 0.99);
        ctrMap.put("Personal Services", 1.37);
        ctrMap.put("Physicians & Surgeons", 1.07);
        ctrMap.put("Real Estate", 2.60);
        ctrMap.put("Restaurants & Food", 2.19);
        ctrMap.put("Shopping, Collectibles & Gifts", 1.67);
        ctrMap.put("Sports & Recreation", 1.27);
        ctrMap.put("Travel", 2.20);

        ctrMap.put("default", 2.00); // 기본값 2%

        return ctrMap;
    }
}

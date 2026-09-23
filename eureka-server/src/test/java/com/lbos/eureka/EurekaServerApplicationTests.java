package com.lbos.eureka;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * This module is pure infrastructure (an {@code @EnableEurekaServer} bootstrap with no
 * business logic of its own), so a context-load smoke test is the meaningful test here -
 * there are no services/branches/validation rules to exercise. See docs/testing.md.
 */
@SpringBootTest(properties = {
        "eureka.client.register-with-eureka=false",
        "eureka.client.fetch-registry=false"
})
class EurekaServerApplicationTests {

    @Test
    void contextLoads() {
    }
}

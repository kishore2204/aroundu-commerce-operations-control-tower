package com.lbos.finance;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableFeignClients(basePackages = "com.lbos.finance.integration.client")
@EnableScheduling
public class LbosFinanceIntegrationApplication {
    public static void main(String[] arguments) {
        SpringApplication.run(LbosFinanceIntegrationApplication.class, arguments);
    }
}

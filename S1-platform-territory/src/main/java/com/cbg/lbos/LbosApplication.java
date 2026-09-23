package com.cbg.lbos;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
@SpringBootApplication
@EnableFeignClients
public class LbosApplication {
    /** Starts the LBOS application. */
    public static void main(String[] args) { SpringApplication.run(LbosApplication.class, args); }
}

package com.university.proxy;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class ProxyController {

    private final WebClient backendClient;
    private final WebClient frontendClient;

    @Value("${backend.url:http://backend:3001}")
    private String backendUrl;

    @Value("${frontend.url:http://frontend:3000}")
    private String frontendUrl;

    public ProxyController() {
        String backend = System.getenv().getOrDefault("BACKEND_URL", "http://backend:3001");
        String frontend = System.getenv().getOrDefault("FRONTEND_URL", "http://frontend:3000");
        
        this.backendClient = WebClient.builder()
                .baseUrl(backend)
                .build();
        
        this.frontendClient = WebClient.builder()
                .baseUrl(frontend)
                .build();
    }

    @RequestMapping(value = "/api/**", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH})
    public Mono<ResponseEntity<Object>> proxyToBackend(ServerHttpRequest request) {
        String requestPath = request.getURI().getPath();
        String queryString = request.getURI().getQuery();
        HttpMethod method = request.getMethod();
        
        String backendPath = requestPath;
        if (requestPath.startsWith("/api")) {
            backendPath = requestPath;
        }
        
        String fullUri = backendPath;
        if (queryString != null && !queryString.isEmpty()) {
            fullUri = backendPath + "?" + queryString;
        }
        
        WebClient.RequestBodySpec requestSpec = backendClient.method(method).uri(fullUri);
        
        requestSpec.headers(headers -> {
            request.getHeaders().forEach((name, values) -> {
                String lowerName = name.toLowerCase();
                if (!lowerName.equals("host") && !lowerName.equals("content-length")) {
                    headers.addAll(name, values);
                }
            });
        });
        
        Mono<ResponseEntity<Object>> response;
        if (method == HttpMethod.POST || method == HttpMethod.PUT || method == HttpMethod.PATCH) {
            response = requestSpec
                    .body(BodyInserters.fromDataBuffers(request.getBody()))
                    .retrieve()
                    .toEntity(Object.class)
                    .timeout(Duration.ofSeconds(30));
        } else {
            response = requestSpec
                    .retrieve()
                    .toEntity(Object.class)
                    .timeout(Duration.ofSeconds(30));
        }
        
        return response.onErrorResume(error -> {
            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error proxying request: " + error.getMessage())));
        });
    }

    @RequestMapping(value = {"/", "/**"}, method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH, RequestMethod.OPTIONS})
    public Mono<ResponseEntity<Object>> proxyToFrontend(ServerHttpRequest request) {
        String requestPath = request.getURI().getPath();
        
        // Пропускаем /api и /health - они обрабатываются другими методами
        if (requestPath.startsWith("/api") || requestPath.equals("/health")) {
            return Mono.error(new RuntimeException("Should not reach here"));
        }
        
        String queryString = request.getURI().getQuery();
        HttpMethod method = request.getMethod();
        
        String fullUri = requestPath;
        if (queryString != null && !queryString.isEmpty()) {
            fullUri = requestPath + "?" + queryString;
        }
        
        WebClient.RequestBodySpec requestSpec = frontendClient.method(method).uri(fullUri);
        
        requestSpec.headers(headers -> {
            request.getHeaders().forEach((name, values) -> {
                String lowerName = name.toLowerCase();
                if (!lowerName.equals("host") && !lowerName.equals("content-length")) {
                    headers.addAll(name, values);
                }
            });
        });
        
        Mono<ResponseEntity<Object>> response;
        if (method == HttpMethod.POST || method == HttpMethod.PUT || method == HttpMethod.PATCH) {
            response = requestSpec
                    .body(BodyInserters.fromDataBuffers(request.getBody()))
                    .retrieve()
                    .toEntity(Object.class)
                    .timeout(Duration.ofSeconds(30));
        } else {
            response = requestSpec
                    .retrieve()
                    .toEntity(Object.class)
                    .timeout(Duration.ofSeconds(30));
        }
        
        return response.onErrorResume(error -> {
            return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error proxying request: " + error.getMessage())));
        });
    }

    @GetMapping("/health")
    public Mono<ResponseEntity<String>> health() {
        return Mono.just(ResponseEntity.ok("Proxy is healthy"));
    }
}

package com.university.proxy;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import jakarta.servlet.http.HttpServletRequest;
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
    public Mono<ResponseEntity<Object>> proxyToBackend(
            HttpServletRequest request,
            @RequestBody(required = false) Object body) {
        
        String requestPath = request.getRequestURI();
        String queryString = request.getQueryString();
        
        String backendPath = requestPath;
        if (requestPath.startsWith("/api")) {
            backendPath = requestPath;
        }
        
        HttpMethod method = HttpMethod.valueOf(request.getMethod());
        
        WebClient.RequestBodySpec requestSpec = backendClient.method(method);
        
        if (queryString != null && !queryString.isEmpty()) {
            requestSpec.uri(uriBuilder -> uriBuilder
                    .path(backendPath)
                    .query(queryString)
                    .build());
        } else {
            requestSpec.uri(backendPath);
        }
        
        requestSpec.headers(headers -> {
            request.getHeaderNames().asIterator().forEachRemaining(headerName -> {
                String lowerName = headerName.toLowerCase();
                if (!lowerName.equals("host") && !lowerName.equals("content-length")) {
                    headers.add(headerName, request.getHeader(headerName));
                }
            });
        });
        
        if (body != null && (method == HttpMethod.POST || method == HttpMethod.PUT || method == HttpMethod.PATCH)) {
            requestSpec.bodyValue(body);
        }
        
        return requestSpec
                .retrieve()
                .toEntity(Object.class)
                .timeout(Duration.ofSeconds(30))
                .onErrorResume(error -> {
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("error", "Error proxying request: " + error.getMessage())));
                });
    }

    @RequestMapping(value = {"/", "/**"}, method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH, RequestMethod.OPTIONS})
    public Mono<ResponseEntity<Object>> proxyToFrontend(
            HttpServletRequest request,
            @RequestBody(required = false) Object body) {
        
        String requestPath = request.getRequestURI();
        
        if (requestPath.startsWith("/api") || requestPath.equals("/health")) {
            return Mono.empty();
        }
        
        String queryString = request.getQueryString();
        HttpMethod method = HttpMethod.valueOf(request.getMethod());
        
        WebClient.RequestBodySpec requestSpec = frontendClient.method(method);
        
        if (queryString != null && !queryString.isEmpty()) {
            requestSpec.uri(uriBuilder -> uriBuilder
                    .path(requestPath)
                    .query(queryString)
                    .build());
        } else {
            requestSpec.uri(requestPath);
        }
        
        requestSpec.headers(headers -> {
            request.getHeaderNames().asIterator().forEachRemaining(headerName -> {
                String lowerName = headerName.toLowerCase();
                if (!lowerName.equals("host") && !lowerName.equals("content-length")) {
                    headers.add(headerName, request.getHeader(headerName));
                }
            });
        });
        
        if (body != null && (method == HttpMethod.POST || method == HttpMethod.PUT || method == HttpMethod.PATCH)) {
            requestSpec.bodyValue(body);
        }
        
        return requestSpec
                .retrieve()
                .toEntity(Object.class)
                .timeout(Duration.ofSeconds(30))
                .onErrorResume(error -> {
                    return Mono.just(ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                            .body(Map.of("error", "Error proxying request: " + error.getMessage())));
                });
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("Proxy is healthy");
    }
}


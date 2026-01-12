package com.university.proxy;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.util.Enumeration;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class ProxyController {

    @Value("${backend.url:http://localhost:3001}")
    private String backendUrlRaw;

    @Value("${frontend.url:http://localhost:3000}")
    private String frontendUrlRaw;

    private String backendUrl;
    private String frontendUrl;
    private final RestTemplate restTemplate;

    public ProxyController() {
        this.restTemplate = new RestTemplate();
    }

    @PostConstruct
    public void init() {
        String backendEnv = System.getenv().getOrDefault("BACKEND_URL", backendUrlRaw);
        String frontendEnv = System.getenv().getOrDefault("FRONTEND_URL", frontendUrlRaw);
        
        System.out.println("=================================================");
        System.out.println("🔗 Backend URL (env): " + backendEnv);
        System.out.println("🔗 Frontend URL (env): " + frontendEnv);
        System.out.println("🔗 Backend URL (raw): " + backendUrlRaw);
        System.out.println("🔗 Frontend URL (raw): " + frontendUrlRaw);
        
        this.backendUrl = normalizeUrl(backendEnv);
        this.frontendUrl = normalizeUrl(frontendEnv);
        
        System.out.println("🔗 Backend URL (normalized): " + this.backendUrl);
        System.out.println("🔗 Frontend URL (normalized): " + this.frontendUrl);
        System.out.println("=================================================");
    }

    private String normalizeUrl(String url) {
        if (url == null || url.isEmpty()) {
            return null;
        }
        
        // Если URL уже содержит протокол, проверяем, есть ли домен
        if (url.startsWith("http://") || url.startsWith("https://")) {
            // Если это только имя сервиса без .onrender.com, добавляем домен
            if (!url.contains(".") && !url.contains("localhost")) {
                return url + ".onrender.com";
            }
            return url;
        }
        
        // Если URL не содержит протокол, добавляем https://
        // Если это только имя сервиса, добавляем .onrender.com
        if (!url.contains(".") && !url.contains("localhost")) {
            return "https://" + url + ".onrender.com";
        }
        
        return "https://" + url;
    }

    @RequestMapping(value = "/api/**")
    public ResponseEntity<byte[]> proxyToBackend(
            HttpServletRequest request,
            @RequestBody(required = false) byte[] body) {
        
        try {
            String targetUrl = buildTargetUrl(request, backendUrl);
            System.out.println("📡 Проксирование к Backend: " + request.getMethod() + " " + targetUrl);
            
            HttpHeaders headers = copyHeaders(request);
            HttpEntity<byte[]> entity = new HttpEntity<>(body, headers);
            HttpMethod method = HttpMethod.valueOf(request.getMethod());
            
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    targetUrl,
                    method,
                    entity,
                    byte[].class
            );
            
            return ResponseEntity
                    .status(response.getStatusCode())
                    .headers(filterResponseHeaders(response.getHeaders()))
                    .body(response.getBody());
                    
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            System.err.println("❌ HTTP ошибка: " + e.getStatusCode() + " - " + e.getStatusText());
            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.APPLICATION_JSON);
            String errorJson = "{\"error\":\"" + e.getStatusText() + "\"}";
            return ResponseEntity
                    .status(e.getStatusCode())
                    .headers(responseHeaders)
                    .body(errorJson.getBytes());
                    
        } catch (ResourceAccessException e) {
            System.err.println("❌ Ошибка подключения к Backend: " + e.getMessage());
            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.APPLICATION_JSON);
            String errorJson = "{\"error\":\"Сервис временно недоступен. Backend сервер не отвечает.\"}";
            return ResponseEntity
                    .status(HttpStatus.BAD_GATEWAY)
                    .headers(responseHeaders)
                    .body(errorJson.getBytes());
                    
        } catch (Exception e) {
            System.err.println("❌ Ошибка проксирования: " + e.getMessage());
            e.printStackTrace();
            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.APPLICATION_JSON);
            String errorMessage = e.getMessage() != null ? e.getMessage().replace("\"", "\\\"") : "Неизвестная ошибка";
            String errorJson = "{\"error\":\"Ошибка сервера: " + errorMessage + "\"}";
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .headers(responseHeaders)
                    .body(errorJson.getBytes());
        }
    }

    @RequestMapping(value = {"/", "/**"})
    public ResponseEntity<byte[]> proxyToFrontend(
            HttpServletRequest request,
            @RequestBody(required = false) byte[] body) {
        
        String requestPath = request.getRequestURI();
        
        if (requestPath.startsWith("/api") || requestPath.equals("/health")) {
            return null;
        }
        
        try {
            String targetUrl = buildTargetUrl(request, frontendUrl);
            System.out.println("📡 Проксирование к Frontend: " + request.getMethod() + " " + targetUrl);
            
            HttpHeaders headers = copyHeaders(request);
            HttpEntity<byte[]> entity = new HttpEntity<>(body, headers);
            HttpMethod method = HttpMethod.valueOf(request.getMethod());
            
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    targetUrl,
                    method,
                    entity,
                    byte[].class
            );
            
            return ResponseEntity
                    .status(response.getStatusCode())
                    .headers(filterResponseHeaders(response.getHeaders()))
                    .body(response.getBody());
                    
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            System.err.println("❌ HTTP ошибка: " + e.getStatusCode() + " - " + e.getStatusText());
            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.APPLICATION_JSON);
            String errorJson = "{\"error\":\"" + e.getStatusText() + "\"}";
            return ResponseEntity
                    .status(e.getStatusCode())
                    .headers(responseHeaders)
                    .body(errorJson.getBytes());
                    
        } catch (ResourceAccessException e) {
            System.err.println("❌ Ошибка подключения к Frontend: " + e.getMessage());
            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.APPLICATION_JSON);
            String errorJson = "{\"error\":\"Сервис временно недоступен. Frontend сервер не отвечает.\"}";
            return ResponseEntity
                    .status(HttpStatus.BAD_GATEWAY)
                    .headers(responseHeaders)
                    .body(errorJson.getBytes());
                    
        } catch (Exception e) {
            System.err.println("❌ Ошибка проксирования: " + e.getMessage());
            e.printStackTrace();
            HttpHeaders responseHeaders = new HttpHeaders();
            responseHeaders.setContentType(MediaType.APPLICATION_JSON);
            String errorMessage = e.getMessage() != null ? e.getMessage().replace("\"", "\\\"") : "Неизвестная ошибка";
            String errorJson = "{\"error\":\"Ошибка сервера: " + errorMessage + "\"}";
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .headers(responseHeaders)
                    .body(errorJson.getBytes());
        }
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("Proxy is healthy");
    }

    private String buildTargetUrl(HttpServletRequest request, String baseUrl) {
        StringBuilder url = new StringBuilder(baseUrl);
        url.append(request.getRequestURI());
        
        if (request.getQueryString() != null) {
            url.append("?").append(request.getQueryString());
        }
        
        return url.toString();
    }

    private HttpHeaders copyHeaders(HttpServletRequest request) {
        HttpHeaders headers = new HttpHeaders();
        Enumeration<String> headerNames = request.getHeaderNames();
        
        while (headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            if (!headerName.equalsIgnoreCase("host") &&
                !headerName.equalsIgnoreCase("content-length")) {
                headers.add(headerName, request.getHeader(headerName));
            }
        }
        
        return headers;
    }

    private HttpHeaders filterResponseHeaders(HttpHeaders headers) {
        HttpHeaders filtered = new HttpHeaders();
        headers.forEach((name, values) -> {
            if (!name.equalsIgnoreCase("transfer-encoding")) {
                filtered.addAll(name, values);
            }
        });
        return filtered;
    }
}

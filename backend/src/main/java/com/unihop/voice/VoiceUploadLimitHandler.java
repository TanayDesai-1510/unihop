package com.unihop.voice;

import com.unihop.common.ApiError;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * Spring rejects uploads over its 1 MB multipart limit before any controller runs. Voice is the only multipart
 * endpoint, so map that to the contract's 400 instead of the generic 500.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class VoiceUploadLimitHandler {

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> tooLarge(MaxUploadSizeExceededException e) {
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", "Recording must be at most 1 MB"));
    }
}

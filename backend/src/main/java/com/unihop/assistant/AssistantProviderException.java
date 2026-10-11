package com.unihop.assistant;

final class AssistantProviderException extends RuntimeException {
    AssistantProviderException() {
        super("Assistant provider request failed");
    }

    AssistantProviderException(Throwable cause) {
        super("Assistant provider request failed", cause);
    }
}

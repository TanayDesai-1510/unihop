package com.unihop.assistant;

import com.unihop.common.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/assistant")
public class AssistantController {

    private final CurrentUser currentUser;
    private final AssistantService assistant;

    public AssistantController(CurrentUser currentUser, AssistantService assistant) {
        this.currentUser = currentUser;
        this.assistant = assistant;
    }

    @PostMapping("/commands")
    public AssistantCommand command(@Valid @RequestBody AssistantCommandRequest request) {
        return assistant.command(currentUser.id(), request.message());
    }
}

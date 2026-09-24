import { apiClient } from "../api-client";
import type { ChatRequestDto, ChatResponseDto } from "../types";

export const chatApi = {
  send: (dto: ChatRequestDto) =>
    apiClient.post<ChatResponseDto>("/chat", dto),

  /**
   * Supprime une conversation (et ses messages) côté backend —
   * `DELETE /chat/conversation/:id`, garde d'appartenance à l'utilisateur
   * courant appliquée côté serveur (voir `ConversationService.deleteConversation`).
   */
  deleteConversation: (id: string) =>
    apiClient.delete<void>(`/chat/conversation/${id}`),
};

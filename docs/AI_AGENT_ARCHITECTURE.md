# AI Agent Architecture — Smart Attendance

## 1. Tổng quan hệ thống Agent

```mermaid
graph TB
    subgraph Client["🖥️ Frontend (Next.js)"]
        ChatUI["Chat Interface<br/>Tool Use Visualization"]
        AgentSelector["Agent Selector Hub"]
    end

    subgraph API["🔌 API Layer"]
        Controller["AiController<br/>POST /ai/chat<br/>GET /ai/conversations"]
    end

    subgraph Orchestrator["🧠 AI Service (Orchestrator)"]
        RateLimit["Rate Limiter<br/>Redis: 30 req/user/hour"]
        ConvManager["Conversation Manager<br/>DB: ai_conversations"]
        AgentLoop["⚡ Agentic Loop<br/>max 10 rounds"]
    end

    subgraph Agents["🤖 5 Specialized Agents"]
        A1["💬 HR Chatbot<br/>Status: ✅ Active"]
        A2["🔍 Anomaly Detector<br/>Status: ✅ Active"]
        A3["📊 Report Generator<br/>Status: ✅ Active"]
        A4["📅 Shift Optimizer<br/>Status: ✅ Active"]
        A5["🔮 Predictive Analytics<br/>Status: ✅ Active"]
    end

    subgraph Tools["🔧 Tool Registry (8 Tools)"]
        T1["query_attendance"]
        T2["query_employees"]
        T3["aggregate_stats"]
        T4["detect_patterns"]
        T5["get_branch_info"]
        T6["calculate_overtime"]
        T7["get_leave_balance"]
        T8["send_notification"]
    end

    subgraph Data["💾 Data Layer"]
        DB[(PostgreSQL<br/>14 tables)]
        Redis[(Redis<br/>Cache + Rate Limit)]
    end

    subgraph External["☁️ External"]
        Claude["Claude API<br/>claude-sonnet-4-20250514<br/>max_tokens: 4096"]
    end

    Client -->|HTTP POST| Controller
    Controller --> RateLimit
    RateLimit --> ConvManager
    ConvManager --> AgentLoop
    AgentLoop -->|System Prompt| Agents
    AgentLoop <-->|messages + tools| Claude
    AgentLoop -->|execute| Tools
    Tools --> DB
    Tools --> Redis
    RateLimit --> Redis
    ConvManager --> DB

    style AgentLoop fill:#f59e0b,stroke:#d97706,color:#000
    style Claude fill:#7c3aed,stroke:#6d28d9,color:#fff
    style A1 fill:#10b981,stroke:#059669,color:#fff
    style A2 fill:#10b981,stroke:#059669,color:#fff
    style A3 fill:#10b981,stroke:#059669,color:#fff
    style A4 fill:#10b981,stroke:#059669,color:#fff
    style A5 fill:#10b981,stroke:#059669,color:#fff
```

## 2. Agentic Loop Flow (Chi tiết)

```mermaid
sequenceDiagram
    participant U as User
    participant C as Controller
    participant S as AiService
    participant CL as Claude API
    participant TE as ToolExecutor
    participant DB as PostgreSQL

    U->>C: POST /ai/chat { message, agentType }
    C->>S: chat(userId, dto, userContext)
    
    Note over S: 1. Check rate limit (Redis)
    Note over S: 2. Load/create conversation
    Note over S: 3. Select system prompt by agentType
    Note over S: 4. Build messages array
    
    S->>CL: messages.create({ system, tools, messages })
    CL-->>S: Response (stop_reason: "tool_use")
    
    rect rgb(255, 243, 224)
        Note over S,DB: ⚡ AGENTIC LOOP (max 10 rounds)
        
        loop While stop_reason === "tool_use"
            S->>S: Extract tool_use blocks
            S->>TE: executeTool(name, input, prisma, context)
            TE->>DB: Prisma query (role-scoped)
            DB-->>TE: Query results
            TE-->>S: JSON string result
            S->>CL: messages.create({ ...messages, tool_results })
            CL-->>S: Response (next round or final)
        end
    end
    
    Note over S: 6. Extract final text response
    Note over S: 7. Save conversation to DB
    Note over S: 8. Increment rate limit counter
    
    S-->>C: { response, toolCalls[], conversationId }
    C-->>U: JSON response
```

## 3. Agent Registry — Chi tiết từng Agent

```mermaid
graph LR
    subgraph HR["💬 HR Chatbot"]
        direction TB
        HR_DESC["Hỏi đáp NL về chấm công, nghỉ phép, lịch làm"]
        HR_TOOLS["Tools: query_attendance, query_employees,<br/>aggregate_stats, get_leave_balance,<br/>get_branch_info"]
        HR_EX["Ví dụ: 'Ai đi trễ nhiều nhất tháng này?'"]
    end
    
    subgraph AD["🔍 Anomaly Detector"]
        direction TB
        AD_DESC["Phát hiện gian lận, pattern bất thường"]
        AD_TOOLS["Tools: detect_patterns, query_attendance,<br/>get_branch_info, send_notification"]
        AD_EX["Trigger: Bull cron mỗi 2h + on-demand"]
    end
    
    subgraph RG["📊 Report Generator"]
        direction TB
        RG_DESC["Tạo báo cáo từ yêu cầu NL"]
        RG_TOOLS["Tools: aggregate_stats, query_attendance,<br/>query_employees"]
        RG_EX["Ví dụ: 'Báo cáo chi nhánh HCM-Q1 tháng 3'"]
    end
    
    subgraph SO["📅 Shift Optimizer"]
        direction TB
        SO_DESC["Gợi ý xếp ca tối ưu"]
        SO_TOOLS["Tools: query_employees, detect_patterns,<br/>query_attendance"]
        SO_EX["Output: Shift assignments + reasoning"]
    end
    
    subgraph PA["🔮 Predictive Analytics"]
        direction TB
        PA_DESC["Dự đoán vắng mặt, trends"]
        PA_TOOLS["Tools: aggregate_stats, detect_patterns,<br/>query_attendance"]
        PA_EX["Output: Predictions + confidence"]
    end

    style HR fill:#3b82f6,stroke:#2563eb,color:#fff
    style AD fill:#ef4444,stroke:#dc2626,color:#fff
    style RG fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style SO fill:#f59e0b,stroke:#d97706,color:#000
    style PA fill:#10b981,stroke:#059669,color:#fff
```

## 4. Tool Registry — Ma trận Agent × Tool

| Tool | HR Chatbot | Anomaly Detector | Report Gen | Shift Opt | Predictive |
|------|:----------:|:----------------:|:----------:|:---------:|:----------:|
| `query_attendance` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `query_employees` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `aggregate_stats` | ✅ | ⬜ | ✅ | ⬜ | ✅ |
| `detect_patterns` | ⬜ | ✅ | ⬜ | ✅ | ✅ |
| `get_branch_info` | ✅ | ✅ | ⬜ | ⬜ | ⬜ |
| `calculate_overtime` | ✅ | ⬜ | ✅ | ⬜ | ⬜ |
| `get_leave_balance` | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| `send_notification` | ⬜ | ✅ | ⬜ | ⬜ | ⬜ |

> **Note**: Hiện tại tất cả 8 tools được expose cho tất cả agents. Ma trận trên thể hiện tools **dự kiến** mỗi agent sẽ dùng nhiều nhất. Claude tự quyết định tool nào cần dùng dựa trên system prompt.

## 5. Tool Executor — Security & Scoping

```mermaid
flowchart TD
    A[Tool Call từ Claude] --> B{toolName?}
    B -->|query_attendance| C[queryAttendance]
    B -->|query_employees| D[queryEmployees]
    B -->|aggregate_stats| E[aggregateStats]
    B -->|detect_patterns| F[detectPatterns]
    B -->|get_branch_info| G[getBranchInfo]
    B -->|calculate_overtime| H[calculateOvertime]
    B -->|get_leave_balance| I[getLeaveBalance]
    B -->|send_notification| J[sendNotification]
    B -->|unknown| K[Return error]
    
    C & D & E & F --> L{User Role?}
    L -->|ADMIN| M[Full access<br/>All branches]
    L -->|MANAGER| N[Auto-scope<br/>Own branch only]
    L -->|EMPLOYEE| O[Auto-scope<br/>Own data only]
    
    M & N & O --> P[(Prisma Query)]
    P --> Q[JSON.stringify result]
    Q --> R[Return to Claude]

    style L fill:#f59e0b,stroke:#d97706,color:#000
    style N fill:#3b82f6,stroke:#2563eb,color:#fff
    style O fill:#10b981,stroke:#059669,color:#fff
```

## 6. Conversation Management

```mermaid
erDiagram
    AI_CONVERSATIONS {
        uuid id PK
        uuid user_id FK
        string agent_type "hr_chatbot | anomaly_detector | ..."
        json messages "Compacted history"
        json metadata "toolCalls count, lastUpdated"
        datetime created_at
        datetime updated_at
    }
    
    USERS ||--o{ AI_CONVERSATIONS : "has many"
```

**Message compaction**: Chỉ lưu text messages (user + assistant), bỏ raw tool_use/tool_result blocks để tiết kiệm DB storage.

## 7. Rate Limiting

```
Redis Key: ai:rate:{userId}
TTL: 3600s (1 hour)
Max: 30 requests/hour/user

Flow:
1. GET ai:rate:{userId} → count
2. If count >= 30 → HTTP 429 Too Many Requests
3. After successful response → INCR + EXPIRE 3600
```

## 8. File Map

```
packages/backend/src/modules/ai/
├── ai.module.ts              # NestJS module registration
├── ai.controller.ts          # REST endpoints
│   ├── POST /ai/chat         # Main agentic chat
│   ├── GET /ai/conversations # List conversations
│   └── GET /ai/conversations/:id
├── ai.service.ts             # ⚡ CORE: Agentic loop orchestrator
│   ├── chat()                # Main method - runs the loop
│   ├── getConversations()    # List user conversations
│   ├── getConversation()     # Get single conversation
│   ├── checkRateLimit()      # Redis rate limit check
│   ├── incrementRateLimit()  # Redis counter increment
│   └── compactMessages()     # Conversation history compaction
├── dto/
│   └── chat.dto.ts           # { message, agentType, conversationId? }
├── tools/
│   ├── tool-registry.ts      # 8 tool definitions (JSON Schema)
│   └── tool-executor.ts      # Tool → Prisma query execution
└── agents/
    └── agent-prompts.ts      # 5 system prompt templates
```

## 9. Cấu hình & Limits

| Parameter | Value | Location |
|-----------|-------|----------|
| Claude Model | `claude-sonnet-4-20250514` | ai.service.ts:94 |
| Max Tokens | 4096 | ai.service.ts:95 |
| Max Tool Rounds | 10 | ai.service.ts:41 |
| Rate Limit | 30 req/user/hour | ai.service.ts:42 |
| Rate Limit TTL | 3600s (1 hour) | ai.service.ts:340 |
| Tool Result Truncation | 500 chars (for UI) | ai.service.ts:311 |
| Conversation Compaction | Text-only (no tool blocks) | ai.service.ts:283 |

## 10. Mở rộng trong tương lai

```mermaid
graph TB
    subgraph Current["✅ Hiện tại"]
        C1["5 Agents"]
        C2["8 Tools"]
        C3["Sync response"]
        C4["Single model"]
    end
    
    subgraph Future["🚀 Có thể mở rộng"]
        F1["Multi-agent collaboration<br/>(Agent gọi Agent)"]
        F2["Custom tools per agent<br/>(restrict tool access)"]
        F3["Streaming response<br/>(SSE/WebSocket)"]
        F4["Model routing<br/>(Haiku cho simple, Sonnet cho complex)"]
        F5["Agent memory<br/>(long-term context per user)"]
        F6["Tool approval workflow<br/>(human-in-the-loop cho send_notification)"]
    end
    
    Current --> Future

    style Current fill:#10b981,stroke:#059669,color:#fff
    style Future fill:#3b82f6,stroke:#2563eb,color:#fff
```

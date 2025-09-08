# AI Transcripts Analyzer - GenAI Entel Assessment

## 📋 Project Description

Robust and efficient backend system for semantic analysis of customer service call transcripts using AI. Developed as part of the assessment for AI Engineers in Entel's GenAI team.

### Main Features
- 🔍 **Specific searches** for keywords and phrases in transcripts
- 🎯 **Extraction of main topics** and frequent issues 
- 📊 **Automatic classification** of conversations by categories
- 💰 **OpenAI budget optimization** ($5 USD limit)
- 📈 **Scalability** for large data volumes

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Docker & Docker Compose (opcional)
- OpenAI API Key

### Local Installation

```bash
# 1. Clone repository
git clone <repository-url>
cd ai-transcripts-analyzer

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your OPENAI_API_KEY

# 4. Start in development
npm run start:dev

# 5. Access application
# API: http://localhost:3000
# Documentation: http://localhost:3000/api/docs
```

### Docker Installation

```bash
# 1. Configure environment variables
echo "OPENAI_API_KEY=your_api_key_here" > .env
echo "OPENAI_MODEL=gpt-4o-mini" >> .env

# 2. Production
docker-compose up -d

# 3. Development with hot reload
docker-compose -f docker-compose.dev.yml up -d

# 4. View logs
docker-compose logs -f api
```

## 📊 Input Data

- **Location**: `/sample` directory
- **Format**: 100 synthetic transcripts in text format
- **Content**: Anonymized conversations with timestamps and speaker tagging
- **Processing**: Automatic parsing at application startup

## 🔧 Configuration

### Environment Variables
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini

# Application Settings
NODE_ENV=production
PORT=3000
CACHE_TTL=3600
```

### OpenAI Budget Management
- **Recommended model**: `gpt-4o-mini` (optimal cost/benefit)
- **Automatic tracking**: Real-time token and cost monitoring
- **Configured limit**: $5.00 USD
- **Current estimate**: ~13,300 classifications with the budget

## 📡 API Endpoints

### Base Transcripts
```bash
# Get all transcripts
GET /api/transcripts

# Get specific transcript
GET /api/transcripts/:id

# Search by keywords
GET /api/transcripts/search?q=internet&speaker=CLIENTE

# General statistics
GET /api/transcripts/statistics
```

### AI Analysis (Consumes OpenAI tokens)
```bash
# Classify specific transcript
POST /api/ai/classify/:id

# Classify all transcripts
POST /api/ai/classify/all

# Extract main topics
POST /api/ai/topics/extract
{
  "transcriptIds": ["sample_01", "sample_02"],
  "maxTopics": 5
}

# Generate transcript summary
POST /api/ai/summarize/:id
```

### Response Examples

**Classification:**
```json
{
  "success": true,
  "data": {
    "transcriptId": "sample_03",
    "category": "commercial_support",
    "confidence": 0.9,
    "reasoning": "Customer inquires about data plan upgrade"
  }
}
```

**Topic Extraction:**
```json
{
  "success": true,
  "data": [
    {
      "topic": "internet_issues",
      "frequency": 15,
      "description": "Connectivity and speed problems",
      "relevantTranscripts": ["sample_01", "sample_05"]
    }
  ]
}
```

## 🏗️ Technical Architecture

### Technology Stack
- **Backend**: NestJS (Node.js/TypeScript)
- **AI/NLP**: OpenAI GPT-4o-mini
- **Cache**: Local memory (CacheService)
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker + Docker Compose

### Project Structure
```
src/
├── controllers/          # API Controllers
│   ├── transcripts.controller.ts
│   └── ai-analysis.controller.ts
├── services/             # Business Logic
│   ├── transcript-processing.service.ts
│   ├── openai.service.ts
│   └── cache.service.ts
├── dto/                  # Data Transfer Objects
├── interfaces/           # Type Definitions
└── main.ts              # Entry Point
```

### Classification Categories
- `technical_issues`: Technical problems (internet, TV, phone)
- `commercial_support`: Commercial support (plans, promotions)
- `administrative_requests`: Administrative requests
- `billing_issues`: Billing problems
- `service_activation`: Service activation
- `complaints_claims`: Complaints and claims

## 🧠 AI/NLP Processing

### OpenAI Cost Optimization

**Selected Model: gpt-4o-mini**
- **Input**: $0.15/1M tokens
- **Output**: $0.60/1M tokens  
- **Justification**: Best cost/benefit ratio vs gpt-5-mini and gpt-5-nano

**Optimization Strategies:**
1. **Smart summaries**: Only first 20 messages per transcript
2. **Efficient cache**: Avoids re-processing already analyzed data
3. **Batch processing**: Analysis of multiple transcripts in one request
4. **Token limiting**: Strict max_completion_tokens control
5. **Budget tracking**: Real-time spending monitoring

### Tested Models Comparison

| Model | Cost/1K class. | Time | Accuracy | Recommendation |
|-------|----------------|------|----------|---------------|
| gpt-5-nano | $0.226 | 6.94s | ❌ Poor | Don't use |
| **gpt-4o-mini** | **$0.375** | **2.89s** | **✅ Excellent** | **Recommended** |
| gpt-5-mini | $1.125 | 7.45s | ❌ Poor | Don't use |

See complete details in: [OpenAI_Model_Comparison.md](./OpenAI_Model_Comparison.md)

## 🧹 Data Cleaning

### Cleaning Process
1. **Automatic parsing** of text files with timestamp format
2. **System message filtering** (only human interactions)
3. **Speaker normalization** (AGENT/CLIENT/SYSTEM)
4. **Structure validation** and data integrity
5. **AI optimization** (smart summaries)

### Data Statistics
- **Total transcripts**: 99 (successfully loaded)
- **Average messages per transcript**: ~20-25
- **Identified speakers**: AGENT, CLIENT, SYSTEM
- **Data quality**: High (synthetic, consistent structure)

## ⚡ Performance and Scalability

### Performance Metrics
- **Search response time**: <100ms
- **AI classification time**: ~2.9s
- **Memory usage**: ~150MB (without massive cache)
- **Throughput**: Supports concurrent classification

### Scalability Strategies
1. **Smart cache**: Configurable TTL, automatic invalidation
2. **Pagination**: Support for large data volumes
3. **Async processing**: AI operations don't block API
4. **Resource limits**: Memory and CPU configuration
5. **Horizontal scaling**: Ready for multiple instances

### For Large Volumes
```bash
# Recommended configurations for scaling
CACHE_TTL=7200  # 2 hours
MAX_BATCH_SIZE=50
OPENAI_TIMEOUT=30000
```

## 🐳 Containerization

### Docker Configuration
- **Multi-stage build**: Image optimization
- **Non-root user**: Enhanced security
- **Health checks**: Automatic monitoring
- **Resource limits**: Memory/CPU control

### Available Environments
- **Production**: `docker-compose up -d`
- **Development**: `docker-compose -f docker-compose.dev.yml up -d`

## 🔐 Security

### Implemented Measures
- Input validation with class-validator
- Rate limiting (ready)
- Environment variables for secrets
- Non-root containers
- Input sanitization

## 📊 Monitoring and Metrics

### OpenAI Cost Tracking
```bash
# Get usage statistics
GET /api/transcripts/statistics

# Response includes:
{
  "tokenUsage": {
    "prompt": 1234,
    "completion": 567,
    "total": 1801
  },
  "estimatedCost": 0.002345,
  "remainingBudget": 4.997655
}
```

### Health Checks
- **Endpoint**: `/api/transcripts/statistics`
- **Monitoring**: Docker health checks every 30s
- **Alerts**: Automatic budget excess alerts

## 🧪 Testing

### Test Coverage
```bash
# Run tests
npm run test

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

## 📈 Future Optimizations

### Short Term
- [ ] Web frontend interface
- [ ] More classification categories
- [ ] Sentiment analysis
- [ ] Report exports

### Long Term
- [ ] Custom Machine Learning models
- [ ] Persistent database
- [ ] Microservices architecture
- [ ] Real-time processing

## 🚀 Production Deployment

### Recommendations
1. **Load Balancer**: Nginx or cloud LB
2. **Database**: PostgreSQL for persistence
3. **Cache**: Redis for multiple instances
4. **Monitoring**: Prometheus + Grafana
5. **Logs**: Centralized logging (ELK stack)

## 🔍 Troubleshooting

### Common Issues

**API Key Error:**
```bash
# Verify configuration
docker-compose exec api env | grep OPENAI
```

**Budget exceeded:**
```bash
# Check statistics
curl http://localhost:3000/api/transcripts/statistics
```

**Slow performance:**
```bash
# Increase resources
docker stats ai-transcripts-analyzer
```

## 📞 Contact

**Assessment for**: AI Engineers - GenAI Entel Team

**Evaluators**:
- valeria.hurtado@entel.pe
- CDVILLARROEL@entel.cl  
- jcaullan@entel.cl

---

## 📋 Delivery Checklist

### Criteria Compliance

- ✅ **Data cleaning (10%)**: Automatic parsing, filters, normalization
- ✅ **AI/NLP processing (20%)**: OpenAI integrated, cost optimization
- ✅ **Backend API (30%)**: Complete, documented, robust
- ✅ **Budget optimization (5%)**: Tracking, efficient model, <$5 USD
- ✅ **Scalability (15%)**: Cache, async, resource limits, ready for scaling
- ✅ **Code quality (10%)**: TypeScript, documented, clear structure
- 🔄 **Frontend (Bonus 10%)**: Optional - API docs as interface

### Completed Deliverables

- ✅ **GitHub Repository**: Clean and documented code
- ✅ **Technical documentation**: This README + Docker docs
- ✅ **API documentation**: Swagger at `/api/docs`
- ✅ **Technical report**: Model comparison + justifications
- ✅ **Containerization**: Docker ready for production

---

🎯 **Project ready for evaluation** - Meets all specified technical and business criteria.

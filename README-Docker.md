# Docker Setup for AI Transcripts Analyzer

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose installed
- OpenAI API Key

### 1. Environment Setup
Create a `.env` file in the root directory:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

### 2. Production Deployment

```bash
# Build and start all services
docker-compose up -d

# Check logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### 3. Development Mode

```bash
# Start development environment with hot reload
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f api-dev

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

## 📋 Available Services

### API Service (Port 3000)
- **Production**: `http://localhost:3000`
- **API Docs**: `http://localhost:3000/api/docs`
- **Health Check**: `http://localhost:3000/api/transcripts/statistics`

## 🛠️ Docker Commands

### Build and Management
```bash
# Build only the API image
docker-compose build api

# Rebuild without cache
docker-compose build --no-cache api

# View running containers
docker-compose ps

# View resource usage
docker stats
```

### Logs and Debugging
```bash
# Follow logs for specific service
docker-compose logs -f api

# View last 100 log lines
docker-compose logs --tail=100 api

# Access container shell
docker-compose exec api sh
```

### Maintenance
```bash
# Remove all containers
docker-compose down

# Remove unused images
docker image prune

# Remove all stopped containers
docker container prune
```

## 🔧 Configuration

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API Key | Required |
| `OPENAI_MODEL` | OpenAI Model | `gpt-4o-mini` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | API Port | `3000` |

### Resource Limits
- **API Container**: 512MB RAM, 0.5 CPU

### Health Checks
- **API**: HTTP check on `/api/transcripts/statistics`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Change ports in docker-compose.yml
   ports:
     - "3001:3000"  # Use different host port
   ```

2. **OpenAI API Key not set**
   ```bash
   # Check environment variables
   docker-compose exec api env | grep OPENAI
   ```

3. **Container won't start**
   ```bash
   # Check detailed logs
   docker-compose logs api
   
   # Rebuild container
   docker-compose build --no-cache api
   ```

4. **Memory issues**
   ```bash
   # Increase memory limits in docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 1G
   ```

### Debug Mode
For development with debugging:
```bash
# Start with debug port exposed
docker-compose -f docker-compose.dev.yml up -d

# Attach debugger to localhost:9229
```

## 📊 Monitoring

### Container Stats
```bash
# Real-time resource usage
docker stats

# Specific container stats
docker stats ai-transcripts-analyzer
```

### Application Metrics
- **API Docs**: `http://localhost:3000/api/docs`
- **Health**: `http://localhost:3000/api/transcripts/statistics`
- **Usage Stats**: Available through API endpoints

## 🔐 Security

### Production Recommendations
1. Use environment files for secrets
2. Configure firewall rules
3. Regular security updates
4. Monitor API usage and costs
5. Use HTTPS with a reverse proxy (if needed)

## 📈 Performance Optimization

### Production Tips
1. **Use multi-stage builds** (already implemented)
2. **Built-in memory caching** (CacheService included)
3. **Monitor OpenAI API usage** (built-in tracking)
4. **Set appropriate resource limits**

### Scaling
```bash
# Scale API containers (if using external load balancer)
docker-compose up -d --scale api=3

# For production scaling, consider:
# - External load balancer (nginx, HAProxy, cloud LB)
# - Container orchestration (Kubernetes, Docker Swarm)
# - External caching (Redis) if needed for multiple instances
```

---

🎯 **Ready to deploy!** Your AI Transcripts Analyzer is now containerized and production-ready.

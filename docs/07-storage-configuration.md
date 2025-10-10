# Storage Configuration

## Overview

Atlas CMMS supports two object storage backends for file management:

1. **MinIO** (default) - Self-hosted, S3-compatible object storage
2. **Google Cloud Storage (GCP)** - Cloud-based object storage

The storage backend is configured via the `STORAGE_TYPE` environment variable.

## MinIO Storage (Default)

### Overview

MinIO is a high-performance, S3-compatible object storage system that runs in a Docker container alongside the application.

**Benefits**:
- ✅ Self-hosted (no cloud costs)
- ✅ S3-compatible API
- ✅ Simple Docker deployment
- ✅ Web-based management console
- ✅ Data sovereignty (all data on-premises)

### MinIO Architecture

**Docker Service** (`docker-compose.yml`):
```yaml
minio:
  image: minio/minio:RELEASE.2025-04-22T22-12-26Z
  container_name: atlas_minio
  environment:
    MINIO_ROOT_USER: ${MINIO_USER}
    MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
  volumes:
    - minio_data:/data
  ports:
    - "9000:9000"  # API endpoint
    - "9001:9001"  # Web console
  command: server --address ":9000" --console-address ":9001" /data
```

**Ports**:
- `9000` - MinIO API (S3-compatible)
- `9001` - MinIO Console (web UI)

**Persistent Storage**: `minio_data` Docker volume

### MinIO Configuration

#### Environment Variables

**Backend** (`docker-compose.yml` - `api` service):
```env
STORAGE_TYPE=MINIO
MINIO_ENDPOINT=http://minio:9000           # Internal Docker network URL
MINIO_BUCKET=atlas-bucket                  # Bucket name
MINIO_ACCESS_KEY=${MINIO_USER}             # Access credentials
MINIO_SECRET_KEY=${MINIO_PASSWORD}         # Secret credentials
PUBLIC_MINIO_ENDPOINT=${PUBLIC_MINIO_ENDPOINT}  # Public access URL
```

**.env File**:
```env
STORAGE_TYPE=MINIO
MINIO_USER=minio
MINIO_PASSWORD=minio123  # CHANGE IN PRODUCTION!
PUBLIC_MINIO_ENDPOINT=http://localhost:9000
```

**For Remote Deployment**:
```env
PUBLIC_MINIO_ENDPOINT=http://your.public.ip:9000
```

#### Application Configuration

**File**: `api/src/main/resources/application.yml`

```yaml
storage:
  type: ${STORAGE_TYPE}  # MINIO or GCP
  minio:
    endpoint: ${MINIO_ENDPOINT}           # http://minio:9000
    bucket: ${MINIO_BUCKET}               # atlas-bucket
    access-key: ${MINIO_ACCESS_KEY}       # ${MINIO_USER}
    secret-key: ${MINIO_SECRET_KEY}       # ${MINIO_PASSWORD}
    public-endpoint: ${PUBLIC_MINIO_ENDPOINT}  # http://localhost:9000
```

### MinIO Setup & Usage

#### Initial Setup

MinIO bucket is **automatically created** by the backend on first file upload.

**Manual Bucket Creation** (via console):
1. Access MinIO Console: http://localhost:9001
2. Login with credentials (`MINIO_USER`, `MINIO_PASSWORD`)
3. Navigate to "Buckets"
4. Click "Create Bucket"
5. Name: `atlas-bucket`
6. Policy: Private (default)

#### MinIO Console

**URL**: http://localhost:9001 (or `http://your-server:9001`)

**Features**:
- Browse and manage files
- View bucket statistics
- Configure access policies
- Monitor storage usage
- Create access keys

#### File Upload Flow

1. **Frontend/Mobile** → `POST /api/files` with multipart form data
2. **Backend** receives file
3. **Backend** uploads to MinIO bucket using MinIO Java client
4. **MinIO** stores file and returns object key
5. **Backend** generates public URL: `${PUBLIC_MINIO_ENDPOINT}/atlas-bucket/${objectKey}`
6. **Backend** saves file metadata to database
7. **Backend** returns file metadata (ID, URL, name, type)

**Java Client** (`io.minio:minio` 8.5.17):
```java
MinioClient minioClient = MinioClient.builder()
    .endpoint(minioEndpoint)
    .credentials(accessKey, secretKey)
    .build();

// Upload file
minioClient.putObject(
    PutObjectArgs.builder()
        .bucket(bucketName)
        .object(objectName)
        .stream(inputStream, size, -1)
        .contentType(contentType)
        .build()
);

// Generate public URL
String publicUrl = publicEndpoint + "/" + bucketName + "/" + objectName;
```

#### File Download Flow

1. **Frontend/Mobile** requests file by ID: `GET /api/files/{id}`
2. **Backend** retrieves file metadata from database
3. **Backend** generates presigned URL (for private buckets) or returns public URL
4. **Client** downloads file directly from MinIO using URL

### MinIO Security

#### Access Control

**Default Policy**: Private bucket (not publicly accessible)

**Access Methods**:
1. **Presigned URLs**: Temporary URLs with expiration (recommended)
2. **Public URLs**: Direct access (if bucket is public)
3. **IAM Policies**: Fine-grained access control

**Presigned URL Generation**:
```java
String presignedUrl = minioClient.getPresignedObjectUrl(
    GetPresignedObjectUrlArgs.builder()
        .method(Method.GET)
        .bucket(bucketName)
        .object(objectName)
        .expiry(24, TimeUnit.HOURS)  // URL valid for 24 hours
        .build()
);
```

#### Credential Management

**Production Security**:
```env
MINIO_USER=<strong-username>
MINIO_PASSWORD=<strong-password>  # Minimum 8 characters
```

**Rotate Credentials**:
1. Create new access key via MinIO console
2. Update `MINIO_USER` and `MINIO_PASSWORD`
3. Restart backend service
4. Delete old access key

### MinIO Backup & Recovery

#### Backup Strategy

**1. Docker Volume Backup**:
```bash
# Stop MinIO
docker-compose stop minio

# Backup volume
docker run --rm -v atlas_minio_data:/data -v $(pwd):/backup ubuntu tar czf /backup/minio_backup_$(date +%Y%m%d).tar.gz /data

# Restart MinIO
docker-compose start minio
```

**2. MinIO Client (mc) Backup**:
```bash
# Install mc
docker exec atlas_minio mc alias set local http://localhost:9000 minio minio123

# Backup bucket
docker exec atlas_minio mc mirror local/atlas-bucket /backup/atlas-bucket/
```

#### Restore

**From Volume Backup**:
```bash
# Stop MinIO
docker-compose stop minio

# Restore volume
docker run --rm -v atlas_minio_data:/data -v $(pwd):/backup ubuntu tar xzf /backup/minio_backup_20250101.tar.gz -C /

# Restart MinIO
docker-compose start minio
```

**From mc Backup**:
```bash
docker exec atlas_minio mc mirror /backup/atlas-bucket/ local/atlas-bucket/
```

### MinIO Monitoring

**Storage Usage**:
```bash
docker exec atlas_minio mc du local/atlas-bucket
```

**Bucket Stats**:
```bash
docker exec atlas_minio mc stat local/atlas-bucket
```

**Logs**:
```bash
docker-compose logs -f minio
```

## Google Cloud Storage (GCP)

### Overview

Google Cloud Storage is a scalable, managed object storage service.

**Benefits**:
- ✅ Managed service (no infrastructure maintenance)
- ✅ High availability and durability
- ✅ Global CDN integration
- ✅ Automatic scaling
- ✅ Pay-as-you-go pricing

**Considerations**:
- ⚠️ Ongoing cloud costs
- ⚠️ Data egress charges
- ⚠️ Requires GCP account and setup

### GCP Setup

**Prerequisites**:
1. Google Cloud Platform account
2. GCP project created
3. Cloud Storage API enabled
4. Service account with Storage Object Admin role

**Detailed Setup Instructions**: See [GCP-setup.md](../GCP-setup.md)

#### Quick Setup Steps

**1. Create GCP Project**:
- Go to https://console.cloud.google.com
- Create new project or select existing

**2. Create Storage Bucket**:
- Navigate to Cloud Storage → Buckets
- Click "Create Bucket"
- Choose bucket name (globally unique)
- Select region (closest to users)
- Choose Standard storage class
- Set access control: Uniform
- Create bucket

**3. Create Service Account**:
- IAM & Admin → Service Accounts
- Create service account
- Grant role: "Storage Object Admin"
- Create JSON key
- Download key file

**4. Configure Backend**:
```env
STORAGE_TYPE=GCP
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-bucket-name
GCP_JSON={"type":"service_account","project_id":"..."}  # Paste JSON content
```

### GCP Configuration

#### Environment Variables

**.env File**:
```env
STORAGE_TYPE=GCP
GCP_PROJECT_ID=atlas-cmms-project
GCP_BUCKET_NAME=atlas-cmms-files
GCP_JSON={"type":"service_account","project_id":"atlas-cmms-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"atlas-storage@atlas-cmms-project.iam.gserviceaccount.com",...}
```

**Alternatively** (for large JSON):
```env
STORAGE_TYPE=GCP
GCP_PROJECT_ID=atlas-cmms-project
GCP_BUCKET_NAME=atlas-cmms-files
GCP_JSON_PATH=/path/to/service-account-key.json
```

#### Application Configuration

**File**: `api/src/main/resources/application.yml`

```yaml
storage:
  type: ${STORAGE_TYPE}
  gcp:
    project-id: ${GCP_PROJECT_ID}
    bucket-name: ${GCP_BUCKET_NAME}
    value: ${GCP_JSON}           # JSON key content
    json-path: ${GCP_JSON_PATH}  # Or path to JSON file
```

### GCP File Operations

**Java Client** (`com.google.cloud:google-cloud-storage` 2.0.1):

**Initialization**:
```java
GoogleCredentials credentials = GoogleCredentials.fromStream(
    new ByteArrayInputStream(gcpJson.getBytes())
);

Storage storage = StorageOptions.newBuilder()
    .setProjectId(projectId)
    .setCredentials(credentials)
    .build()
    .getService();
```

**Upload File**:
```java
BlobId blobId = BlobId.of(bucketName, objectName);
BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
    .setContentType(contentType)
    .build();

storage.create(blobInfo, fileBytes);

// Generate public URL
String publicUrl = String.format("https://storage.googleapis.com/%s/%s",
    bucketName, objectName);
```

**Download File**:
```java
BlobId blobId = BlobId.of(bucketName, objectName);
byte[] content = storage.readAllBytes(blobId);
```

**Delete File**:
```java
BlobId blobId = BlobId.of(bucketName, objectName);
storage.delete(blobId);
```

### GCP Security

#### Access Control

**Bucket Permissions**:
- **Private**: Service account only (default, recommended)
- **Public**: Public read access (not recommended for user files)

**IAM Roles**:
- Service Account: Storage Object Admin (full bucket access)
- Users: No direct access (app controls access)

**Signed URLs** (temporary access):
```java
URL signedUrl = storage.signUrl(
    blobInfo,
    15, TimeUnit.MINUTES,  // URL valid for 15 minutes
    SignUrlOption.withV4Signature()
);
```

#### Service Account Security

**Best Practices**:
- ✅ Use dedicated service account for Atlas CMMS
- ✅ Grant minimum required permissions (Storage Object Admin for bucket only)
- ✅ Rotate service account keys periodically
- ✅ Store JSON key securely (environment variables, secrets manager)
- ❌ Never commit JSON key to version control

### GCP Backup & Recovery

#### Automatic Backups

GCP provides built-in redundancy:
- **Standard Storage**: 99.99% availability, 99.999999999% durability
- **Multi-regional**: Replicated across regions

#### Manual Backups

**Using gsutil**:
```bash
# Install Google Cloud SDK
# Initialize: gcloud init

# Backup bucket
gsutil -m cp -r gs://atlas-cmms-files ./backup/

# Restore bucket
gsutil -m cp -r ./backup/* gs://atlas-cmms-files/
```

**Using GCP Console**:
- Cloud Storage → Buckets → atlas-cmms-files
- Select objects → Download

### GCP Monitoring

**Storage Usage**:
- GCP Console → Cloud Storage → Buckets
- View total size and object count

**Costs**:
- GCP Console → Billing → Reports
- Monitor storage costs and egress

**Logs**:
- GCP Console → Logging → Logs Explorer
- Filter: `resource.type="gcs_bucket"`

### GCP Cost Optimization

**Storage Classes**:
- **Standard**: Frequent access (default)
- **Nearline**: Access < 1/month (cheaper)
- **Coldline**: Access < 1/quarter
- **Archive**: Rarely accessed

**Lifecycle Policies**:
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {"age": 90}
      },
      {
        "action": {"type": "Delete"},
        "condition": {"age": 365}
      }
    ]
  }
}
```

**Apply policy**:
```bash
gsutil lifecycle set lifecycle.json gs://atlas-cmms-files
```

## Switching Storage Backends

### MinIO to GCP

1. **Backup MinIO Files**:
   ```bash
   docker exec atlas_minio mc mirror local/atlas-bucket ./backup/
   ```

2. **Create GCP Bucket** and configure service account

3. **Upload Files to GCP**:
   ```bash
   gsutil -m cp -r ./backup/* gs://atlas-cmms-files/
   ```

4. **Update Environment**:
   ```env
   STORAGE_TYPE=GCP
   GCP_PROJECT_ID=...
   GCP_BUCKET_NAME=...
   GCP_JSON=...
   ```

5. **Update Database** (file URLs):
   ```sql
   UPDATE file
   SET url = REPLACE(url, 'http://localhost:9000/atlas-bucket', 'https://storage.googleapis.com/atlas-cmms-files');
   ```

6. **Restart Services**:
   ```bash
   docker-compose restart api
   ```

### GCP to MinIO

1. **Download Files from GCP**:
   ```bash
   gsutil -m cp -r gs://atlas-cmms-files/* ./backup/
   ```

2. **Setup MinIO** (via docker-compose)

3. **Upload Files to MinIO**:
   ```bash
   docker exec atlas_minio mc mirror ./backup/ local/atlas-bucket/
   ```

4. **Update Environment**:
   ```env
   STORAGE_TYPE=MINIO
   MINIO_ENDPOINT=http://minio:9000
   MINIO_BUCKET=atlas-bucket
   MINIO_ACCESS_KEY=minio
   MINIO_SECRET_KEY=minio123
   PUBLIC_MINIO_ENDPOINT=http://localhost:9000
   ```

5. **Update Database** (file URLs):
   ```sql
   UPDATE file
   SET url = REPLACE(url, 'https://storage.googleapis.com/atlas-cmms-files', 'http://localhost:9000/atlas-bucket');
   ```

6. **Restart Services**:
   ```bash
   docker-compose restart api
   ```

## File Management Best Practices

### File Upload Limits

**Backend Configuration** (`application.yml`):
```yaml
spring:
  servlet:
    multipart:
      max-file-size: 7MB
      max-request-size: 7MB
```

**Adjust for Your Needs**:
```yaml
max-file-size: 50MB
max-request-size: 50MB
```

### File Organization

**Recommended Naming Strategy**:
```
{company-id}/{entity-type}/{entity-id}/{timestamp}-{original-filename}
```

Example:
```
123/work-orders/456/1704067200000-pump-photo.jpg
```

**Benefits**:
- Easy to identify file ownership
- Prevents naming conflicts
- Enables bulk operations by company/entity

### File Cleanup

**Orphaned Files**: Files without database reference

**Cleanup Strategy**:
1. Identify orphaned files (files not in `file` table)
2. Archive or delete after grace period (e.g., 30 days)

**Automated Cleanup** (pseudo-code):
```java
@Scheduled(cron = "0 0 2 * * ?")  // Daily at 2 AM
public void cleanupOrphanedFiles() {
    List<String> storageFiles = storageService.listAllFiles();
    List<String> dbFiles = fileRepository.findAll()
        .stream()
        .map(File::getUrl)
        .collect(Collectors.toList());

    List<String> orphaned = storageFiles.stream()
        .filter(f -> !dbFiles.contains(f))
        .collect(Collectors.toList());

    // Delete orphaned files older than 30 days
    orphaned.forEach(storageService::delete);
}
```

### Storage Monitoring

**Track Storage Usage**:
- Monitor bucket size
- Alert on rapid growth
- Track per-company usage

**Database Queries**:
```sql
-- Total files
SELECT COUNT(*) FROM file;

-- Files per company
SELECT cs.id, c.name, COUNT(f.id) AS file_count
FROM file f
JOIN company_settings cs ON f.company_settings_id = cs.id
JOIN company c ON cs.company_id = c.id
GROUP BY cs.id, c.name
ORDER BY file_count DESC;

-- Storage by file type
SELECT type, COUNT(*) AS count
FROM file
GROUP BY type
ORDER BY count DESC;
```

## Troubleshooting

### MinIO Issues

**Cannot connect to MinIO**:
- ✓ Check MinIO container is running: `docker-compose ps`
- ✓ Verify port 9000 is accessible
- ✓ Check `MINIO_ENDPOINT` matches MinIO service name in Docker network
- ✓ Verify credentials in `.env`

**Bucket not found**:
- Create bucket manually via MinIO Console
- Verify `MINIO_BUCKET` environment variable

**Files not accessible**:
- Check `PUBLIC_MINIO_ENDPOINT` is correct
- Verify bucket policy (should be private or public read)
- Check firewall rules for port 9000

### GCP Issues

**Authentication failed**:
- ✓ Verify `GCP_JSON` is valid JSON
- ✓ Check service account has Storage Object Admin role
- ✓ Ensure Cloud Storage API is enabled

**Bucket access denied**:
- Verify service account has permissions for bucket
- Check bucket name matches `GCP_BUCKET_NAME`

**High costs**:
- Review storage class (use Nearline/Coldline for old files)
- Implement lifecycle policies
- Monitor egress (file download) costs

## Performance Optimization

### Upload Performance

**Frontend**:
- Compress images before upload
- Use appropriate file formats (WebP for images, PDF for documents)
- Implement client-side validation (file size, type)

**Backend**:
- Stream large files (don't load entirely in memory)
- Use multipart uploads for large files (>5MB)
- Implement async processing for heavy operations

### Download Performance

**CDN Integration**:
- **GCP**: Enable Cloud CDN for bucket
- **MinIO**: Use reverse proxy with caching (nginx, Cloudflare)

**Caching**:
```java
@Cacheable("file-urls")
public String getFileUrl(Long fileId) {
    File file = fileRepository.findById(fileId).orElseThrow();
    return file.getUrl();
}
```

**Presigned URLs** (cache for duration):
- Generate once, reuse for URL validity period
- Cache in Redis or application memory

## Compliance & Data Residency

### Data Sovereignty

**MinIO**:
- ✅ Full control over data location
- ✅ On-premises deployment
- ✅ No third-party access

**GCP**:
- ⚠️ Choose region for compliance (EU, US, Asia)
- ⚠️ Review GCP data processing agreement
- ⚠️ May require Business Associate Agreement (HIPAA)

### GDPR Compliance

**Right to Deletion**:
- Implement file deletion on user/company deletion
- Verify deletion from storage backend
- Log deletion events

**Data Export**:
- Provide file export functionality
- Generate archive of all user files

## Future Enhancements

**Potential Features**:
- Hybrid storage (MinIO + GCP failover)
- AWS S3 support
- Azure Blob Storage support
- File versioning
- Deduplication
- Encryption at rest (customer-managed keys)
- Advanced file processing (thumbnail generation, virus scanning)

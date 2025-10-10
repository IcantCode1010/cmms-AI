# syntax=docker/dockerfile:1

FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /workspace
COPY api/pom.xml ./pom.xml
COPY api/src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=builder /workspace/target/app.jar ./app.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]

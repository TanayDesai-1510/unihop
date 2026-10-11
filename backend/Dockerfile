# UniHop backend image (Render / Railway / any Docker host). Build context: backend/
#   docker build -t unihop-backend backend
# Runtime config comes from env vars (Spring relaxed binding overrides application.yml):
#   SPRING_DATASOURCE_URL=jdbc:postgresql://<host>:<port>/<db>   SPRING_DATASOURCE_USERNAME / _PASSWORD
#   JWT_SECRET (32+ chars)   CORS_ORIGINS (comma-separated, e.g. the Vercel URL)   FRONTEND_URL
#   PORT (set by the platform; defaults to 8080)

FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -B dependency:go-offline
COPY src src
RUN ./mvnw -q -B package -DskipTests && cp target/backend-*.jar app.jar

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 unihop
COPY --from=build /src/app.jar app.jar
USER unihop
EXPOSE 8080
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75"
CMD ["sh", "-c", "exec java $JAVA_OPTS -Dserver.port=${PORT:-8080} -jar app.jar"]

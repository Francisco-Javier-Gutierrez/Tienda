variable "aws_region" {
  description = "Región de AWS para desplegar la infraestructura"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Perfil de AWS CLI a utilizar"
  type        = string
  default     = "terra-profile"
}

variable "bucket_name" {
  description = "Nombre del bucket S3 para alojar el frontend estático"
  type        = string
  default     = "tienda-donapaty-frontend"
}

variable "environment" {
  description = "Entorno de despliegue (production, staging, dev)"
  type        = string
  default     = "production"
}

variable "app_name" {
  description = "Identificador base de la aplicación"
  type        = string
  default     = "tienda-donapaty"
}

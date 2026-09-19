data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../backend/dist/index.js"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_iam_role" "lambda_exec" {
  name = "${var.app_name}-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  inline_policy {
    name = "${var.app_name}-lambda-inline-policy"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ]
          Resource = "arn:aws:logs:*:*:*"
        },
        {
          Effect = "Allow"
          Action = [
            "dynamodb:BatchGetItem",
            "dynamodb:BatchWriteItem",
            "dynamodb:DeleteItem",
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:Query",
            "dynamodb:Scan",
            "dynamodb:UpdateItem",
            "dynamodb:TransactWriteItems",
            "dynamodb:TransactGetItems",
            "dynamodb:ConditionCheckItem",
            "dynamodb:PartiQLSelect",
            "dynamodb:PartiQLUpdate",
            "dynamodb:PartiQLInsert",
            "dynamodb:PartiQLDelete"
          ]
          Resource = [
            aws_dynamodb_table.tienda.arn,
            "${aws_dynamodb_table.tienda.arn}/index/*"
          ]
        },
        {
          Effect = "Allow"
          Action = [
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject"
          ]
          Resource = [
            "arn:aws:s3:::${var.uploads_bucket_name}/*"
          ]
        }
      ]
    })
  }
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.app_name}-api-${var.environment}"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_exec.arn
  memory_size      = 512
  timeout          = 29

  environment {
    variables = {
      NODE_ENV             = "production"
      DYNAMODB_TABLE       = aws_dynamodb_table.tienda.name
      JWT_SECRET           = var.jwt_secret
      GOOGLE_CLIENT_ID     = var.google_client_id
      GOOGLE_CLIENT_SECRET = var.google_client_secret
      AWS_BUCKET_NAME      = var.uploads_bucket_name
      HASHIDS_SALT         = var.hashids_salt
      CLIENT_URL           = "https://${aws_cloudfront_distribution.frontend.domain_name}"
      FCM_CREDENTIALS_JSON = fileexists("${path.module}/../backend/src/config/fcm-credentials.json") ? file("${path.module}/../backend/src/config/fcm-credentials.json") : ""
    }
  }

  tags = {
    Name        = "${var.app_name}-api-${var.environment}"
    Environment = var.environment
  }
}

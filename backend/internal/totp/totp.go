package totp

import (
	"crypto/hmac"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"hash"
	"math"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	DefaultAlgorithm = "SHA1"
	DefaultDigits    = 6
	DefaultPeriod    = 30
)

type Account struct {
	ID          string    `json:"id"`
	Issuer      string    `json:"issuer"`
	AccountName string    `json:"accountName"`
	Algorithm   string    `json:"algorithm"`
	Digits      int       `json:"digits"`
	Period      int       `json:"period"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`

	secret string
}

type CreateAccountRequest struct {
	Issuer      string `json:"issuer"`
	AccountName string `json:"accountName"`
	Secret      string `json:"secret"`
	OTPAUTHURL  string `json:"otpauthUrl"`
	Algorithm   string `json:"algorithm"`
	Digits      int    `json:"digits"`
	Period      int    `json:"period"`
}

type UpdateAccountRequest struct {
	Issuer      *string `json:"issuer"`
	AccountName *string `json:"accountName"`
	Secret      *string `json:"secret"`
	OTPAUTHURL  *string `json:"otpauthUrl"`
	Algorithm   *string `json:"algorithm"`
	Digits      *int    `json:"digits"`
	Period      *int    `json:"period"`
}

type CodeResponse struct {
	Code      string    `json:"code"`
	Period    int       `json:"period"`
	ExpiresIn int       `json:"expiresIn"`
	ExpiresAt time.Time `json:"expiresAt"`
}

func (a Account) Public() Account {
	a.secret = ""
	return a
}

func NewAccount(id string, req CreateAccountRequest, now time.Time) (Account, error) {
	parsed, err := normalizeCreateRequest(req)
	if err != nil {
		return Account{}, err
	}
	return Account{
		ID:          id,
		Issuer:      parsed.Issuer,
		AccountName: parsed.AccountName,
		Algorithm:   parsed.Algorithm,
		Digits:      parsed.Digits,
		Period:      parsed.Period,
		CreatedAt:   now,
		UpdatedAt:   now,
		secret:      parsed.Secret,
	}, nil
}

func ApplyUpdate(account Account, req UpdateAccountRequest, now time.Time) (Account, error) {
	if req.OTPAUTHURL != nil && strings.TrimSpace(*req.OTPAUTHURL) != "" {
		parsed, err := ParseOTPAUTHURL(*req.OTPAUTHURL)
		if err != nil {
			return Account{}, err
		}
		account.Issuer = parsed.Issuer
		account.AccountName = parsed.AccountName
		account.Algorithm = parsed.Algorithm
		account.Digits = parsed.Digits
		account.Period = parsed.Period
		account.secret = parsed.Secret
	}
	if req.Issuer != nil {
		account.Issuer = strings.TrimSpace(*req.Issuer)
	}
	if req.AccountName != nil {
		account.AccountName = strings.TrimSpace(*req.AccountName)
	}
	if req.Secret != nil && strings.TrimSpace(*req.Secret) != "" {
		account.secret = normalizeSecret(*req.Secret)
	}
	if req.Algorithm != nil {
		account.Algorithm = normalizeAlgorithm(*req.Algorithm)
	}
	if req.Digits != nil {
		account.Digits = *req.Digits
	}
	if req.Period != nil {
		account.Period = *req.Period
	}
	if err := validate(account.AccountName, account.secret, account.Algorithm, account.Digits, account.Period); err != nil {
		return Account{}, err
	}
	account.UpdatedAt = now
	return account, nil
}

func Generate(account Account, now time.Time) (CodeResponse, error) {
	code, err := Code(account.secret, account.Algorithm, account.Digits, account.Period, now)
	if err != nil {
		return CodeResponse{}, err
	}
	unix := now.Unix()
	period := int64(account.Period)
	remaining := int(period - unix%period)
	if remaining == 0 {
		remaining = account.Period
	}
	expiresAt := now.Add(time.Duration(remaining) * time.Second).UTC()
	return CodeResponse{
		Code:      code,
		Period:    account.Period,
		ExpiresIn: remaining,
		ExpiresAt: expiresAt,
	}, nil
}

func Code(secret string, algorithm string, digits int, period int, now time.Time) (string, error) {
	if err := validate("account", secret, algorithm, digits, period); err != nil {
		return "", err
	}
	key, err := decodeSecret(secret)
	if err != nil {
		return "", err
	}
	counter := uint64(now.Unix() / int64(period))
	var counterBytes [8]byte
	binary.BigEndian.PutUint64(counterBytes[:], counter)

	mac := hmac.New(hashFactory(algorithm), key)
	_, _ = mac.Write(counterBytes[:])
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	binaryCode := (uint32(sum[offset])&0x7f)<<24 |
		(uint32(sum[offset+1])&0xff)<<16 |
		(uint32(sum[offset+2])&0xff)<<8 |
		(uint32(sum[offset+3]) & 0xff)
	otp := binaryCode % uint32(math.Pow10(digits))
	return fmt.Sprintf("%0*d", digits, otp), nil
}

func ParseOTPAUTHURL(raw string) (CreateAccountRequest, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return CreateAccountRequest{}, fmt.Errorf("invalid otpauth URL")
	}
	if parsed.Scheme != "otpauth" || parsed.Host != "totp" {
		return CreateAccountRequest{}, fmt.Errorf("only otpauth://totp URLs are supported")
	}

	query := parsed.Query()
	issuer := strings.TrimSpace(query.Get("issuer"))
	label := strings.TrimPrefix(parsed.EscapedPath(), "/")
	label, _ = url.PathUnescape(label)
	accountName := strings.TrimSpace(label)
	if strings.Contains(label, ":") {
		parts := strings.SplitN(label, ":", 2)
		if issuer == "" {
			issuer = strings.TrimSpace(parts[0])
		}
		accountName = strings.TrimSpace(parts[1])
	}

	digits := DefaultDigits
	if value := query.Get("digits"); value != "" {
		if parsedDigits, err := strconv.Atoi(value); err == nil {
			digits = parsedDigits
		}
	}
	period := DefaultPeriod
	if value := query.Get("period"); value != "" {
		if parsedPeriod, err := strconv.Atoi(value); err == nil {
			period = parsedPeriod
		}
	}

	req := CreateAccountRequest{
		Issuer:      issuer,
		AccountName: accountName,
		Secret:      query.Get("secret"),
		Algorithm:   query.Get("algorithm"),
		Digits:      digits,
		Period:      period,
	}
	if err := validate(req.AccountName, req.Secret, normalizeAlgorithm(req.Algorithm), req.Digits, req.Period); err != nil {
		return CreateAccountRequest{}, err
	}
	req.Secret = normalizeSecret(req.Secret)
	req.Algorithm = normalizeAlgorithm(req.Algorithm)
	return req, nil
}

func normalizeCreateRequest(req CreateAccountRequest) (CreateAccountRequest, error) {
	if strings.TrimSpace(req.OTPAUTHURL) != "" {
		return ParseOTPAUTHURL(req.OTPAUTHURL)
	}
	req.Issuer = strings.TrimSpace(req.Issuer)
	req.AccountName = strings.TrimSpace(req.AccountName)
	req.Secret = normalizeSecret(req.Secret)
	req.Algorithm = normalizeAlgorithm(req.Algorithm)
	if req.Digits == 0 {
		req.Digits = DefaultDigits
	}
	if req.Period == 0 {
		req.Period = DefaultPeriod
	}
	if err := validate(req.AccountName, req.Secret, req.Algorithm, req.Digits, req.Period); err != nil {
		return CreateAccountRequest{}, err
	}
	return req, nil
}

func validate(accountName string, secret string, algorithm string, digits int, period int) error {
	if strings.TrimSpace(accountName) == "" {
		return fmt.Errorf("accountName is required")
	}
	if strings.TrimSpace(secret) == "" {
		return fmt.Errorf("secret is required")
	}
	if _, err := decodeSecret(secret); err != nil {
		return fmt.Errorf("secret must be valid base32")
	}
	switch normalizeAlgorithm(algorithm) {
	case "SHA1", "SHA256", "SHA512":
	default:
		return fmt.Errorf("algorithm must be SHA1, SHA256, or SHA512")
	}
	if digits != 6 && digits != 8 {
		return fmt.Errorf("digits must be 6 or 8")
	}
	if period < 10 || period > 300 {
		return fmt.Errorf("period must be between 10 and 300 seconds")
	}
	return nil
}

func decodeSecret(secret string) ([]byte, error) {
	normalized := normalizeSecret(secret)
	padding := len(normalized) % 8
	if padding != 0 {
		normalized += strings.Repeat("=", 8-padding)
	}
	return base32.StdEncoding.DecodeString(normalized)
}

func normalizeSecret(secret string) string {
	secret = strings.ToUpper(strings.TrimSpace(secret))
	secret = strings.ReplaceAll(secret, " ", "")
	secret = strings.ReplaceAll(secret, "-", "")
	return strings.TrimRight(secret, "=")
}

func normalizeAlgorithm(algorithm string) string {
	algorithm = strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(algorithm), "-", ""))
	if algorithm == "" {
		return DefaultAlgorithm
	}
	return algorithm
}

func hashFactory(algorithm string) func() hash.Hash {
	switch normalizeAlgorithm(algorithm) {
	case "SHA256":
		return sha256.New
	case "SHA512":
		return sha512.New
	default:
		return sha1.New
	}
}

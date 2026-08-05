package totp

import (
	"testing"
	"time"
)

func TestCodeRFC6238SHA1(t *testing.T) {
	code, err := Code("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "SHA1", 8, 30, time.Unix(59, 0))
	if err != nil {
		t.Fatalf("expected code, got error: %v", err)
	}
	if code != "94287082" {
		t.Fatalf("expected RFC code 94287082, got %s", code)
	}
}

func TestParseOTPAUTHURL(t *testing.T) {
	req, err := ParseOTPAUTHURL("otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&period=30&digits=6")
	if err != nil {
		t.Fatalf("expected parsed URL, got error: %v", err)
	}
	if req.Issuer != "Example" || req.AccountName != "alice@example.com" || req.Secret != "JBSWY3DPEHPK3PXP" {
		t.Fatalf("unexpected parsed request: %#v", req)
	}
}
